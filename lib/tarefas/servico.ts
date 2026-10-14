import "server-only"

import { supabase } from "@/lib/supabase/server"
import type { CurrentUser } from "@/lib/auth"
import { idsDoEscritorio } from "@/lib/escritorio"
import { toCamelCase, toSnakeCase } from "@/lib/utils"
import { AcaoFluxoSchema, DuvidaSchema, TarefaCriacaoSchema } from "@/lib/validators"
import {
  ETAPAS,
  etapaBastaUm,
  etapaDaTarefa,
  linhasPelaPasta,
  responsaveisPadrao,
  type LinhaFluxo,
  type TarefaComLugar,
} from "@/lib/domain/tarefa"
import {
  MENSAGEM_SEM_MIGRATION,
  atribuicoesDaTarefa,
  atribuicoesParaTela,
  faltaMigration,
  fluxoDisponivel,
  garantirNoFluxo,
  tarefasDeIntimacao,
  usuariosDoFluxo,
} from "@/lib/fluxo/servidor"

/**
 * O que as rotas de tarefa fazem, separado de quem pediu e de como.
 *
 * As telas chegam pelas rotas de API, com a sessão do navegador; o
 * Claude chega pelo conector (app/api/mcp), com a chave dele. Os dois
 * caminhos passam por aqui, para que a regra seja uma só: o que a
 * equipe pode fazer pela tela é exatamente o que o Claude pode fazer
 * pelo conector — nem mais, nem menos.
 *
 * Cada função devolve o status HTTP e o corpo da resposta; a rota só
 * embrulha em NextResponse, e o conector traduz em texto.
 */

export type Resultado = { status: number; corpo: Record<string, unknown> }

const erro = (status: number, mensagem: string): Resultado => ({ status, corpo: { error: mensagem } })

// ── Criar ─────────────────────────────────────────────────

/**
 * `origemId` marca de onde a tarefa veio ("claude:djen-123"). O banco
 * não aceita duas tarefas com a mesma origem: quem cria por rotina
 * (o Claude, todo dia) pode repetir o pedido sem duplicar a tarefa.
 */
export async function criarTarefa(
  user: CurrentUser,
  body: unknown,
  opcoes: { origemId?: string } = {}
): Promise<Resultado> {
  const validado = TarefaCriacaoSchema.safeParse(body)
  if (!validado.success) {
    return erro(400, validado.error.issues[0]?.message || "Dados inválidos")
  }

  // A etapa e os responsáveis não são colunas da tarefa: vão para as
  // atribuições, depois de gravada a tarefa.
  const { etapa, responsaveis, ...campos } = validado.data
  if (etapa) {
    if (campos.setor && campos.setor !== ETAPAS[etapa].time) {
      return erro(400, "A etapa não é deste time")
    }
    campos.setor = ETAPAS[etapa].time
    // A pasta guarda a etapa também: se o fluxo ainda não estiver
    // ligado no banco, é por ela que a tela acha a etapa.
    if (!campos.pasta) campos.pasta = ETAPAS[etapa].pasta
  }

  const equipe = await usuariosDoFluxo()
  const daEquipe = new Set(equipe.map((u) => u.id))
  const pedidos = [...(responsaveis ?? []), ...(campos.responsavelId ? [campos.responsavelId] : [])]
  if (pedidos.some((id) => !daEquipe.has(id))) {
    return erro(400, "Responsável fora da equipe do escritório")
  }

  if (validado.data.processoId) {
    const { data: processo, error: processoError } = await supabase
      .from("processos")
      .select("id")
      .eq("id", validado.data.processoId)
      .in("user_id", await idsDoEscritorio())
      .single()

    if (processoError || !processo) {
      return erro(404, "Processo não encontrado ou não autorizado")
    }
  }

  const { data: tarefa, error } = await supabase
    .from("tarefas")
    .insert({ ...toSnakeCase(campos), user_id: user.id, ...(opcoes.origemId ? { origem_id: opcoes.origemId } : {}) })
    .select("*, responsavel:users!tarefas_responsavel_id_fkey(id, name)")
    .single()

  if (error?.code === "23505" && opcoes.origemId) {
    return { status: 409, corpo: { error: "Já existe uma tarefa com essa origem", duplicada: true } }
  }
  if (error || !tarefa) {
    console.error("Create tarefa error:", error)
    return erro(500, "Erro interno do servidor")
  }

  const resposta = toCamelCase(tarefa) as Record<string, unknown>

  // Tarefa nova com time já nasce no fluxo: na etapa pedida (ou na que
  // a pasta indicar) e com os responsáveis pedidos — ou, sem nenhum,
  // com os que a etapa indica.
  if (campos.setor && (await fluxoDisponivel())) {
    try {
      const etapaFinal = etapa ?? etapaDaTarefa({ setor: campos.setor, pasta: campos.pasta ?? null })
      const quem: (string | null)[] = responsaveis?.length
        ? responsaveis
        : campos.responsavelId
          ? [campos.responsavelId]
          : (etapaFinal ? responsaveisPadrao(etapaFinal, equipe) : null) ?? [null]
      const linhas: LinhaFluxo[] = quem.map((r) => ({ setor: campos.setor!, etapa: etapaFinal, responsavelId: r }))
      await garantirNoFluxo({ id: tarefa.id, setor: campos.setor }, user.id, linhas)
      resposta.atribuicoes = await atribuicoesDaTarefa(tarefa.id)
    } catch (erroFluxo) {
      const e = erroFluxo as { code?: string; message?: string }
      if (!faltaMigration(e)) console.error("Nova tarefa no fluxo:", e.message)
    }
  }

  return { status: 201, corpo: { message: "Tarefa criada com sucesso", tarefa: resposta } }
}

// ── Ações do fluxo ────────────────────────────────────────

/** Esta tarefa foi aberta por uma intimação do DJEN? */
async function nasceuDeIntimacao(tarefaId: string) {
  const { data } = await supabase.from("comunicacoes_djen").select("id").eq("tarefa_id", tarefaId).limit(1)
  return Boolean(data?.length)
}

type ErroBanco = { code?: string | null; message?: string | null; details?: string | null }

/**
 * Ações do fluxo sobre uma tarefa: mover de etapa (inclusive voltar),
 * pôr também em outro lugar, concluir a parte de alguém, concluir a
 * etapa para todos, trocar os responsáveis.
 *
 * Tarefa que ainda segue a pasta do TickTick entra no fluxo aqui, na
 * primeira ação: as linhas que a pasta indica são gravadas e só depois
 * a ação é feita.
 *
 * A resposta traz a tarefa como ficou, com as atribuições — a tela
 * troca o cartão pelo que o banco diz, em vez de adivinhar.
 */
export async function agirNoFluxo(user: CurrentUser, id: string, body: unknown): Promise<Resultado> {
  const parsed = AcaoFluxoSchema.safeParse(body)
  if (!parsed.success) return erro(400, parsed.error.issues[0]?.message ?? "Dados inválidos")
  const acao = parsed.data

  try {
    if (!(await fluxoDisponivel())) return erro(503, MENSAGEM_SEM_MIGRATION)

    const escritorio = await idsDoEscritorio()
    const { data: tarefa, error: erroTarefa } = await supabase
      .from("tarefas")
      .select("id, setor, pasta, titulo, tipo, status, responsavel_id, created_at")
      .eq("id", id)
      .in("user_id", escritorio)
      .maybeSingle()

    if (erroTarefa) throw erroTarefa
    if (!tarefa) return erro(404, "Tarefa não encontrada")
    if (tarefa.status === "CONCLUIDA" || tarefa.status === "CANCELADA") {
      return erro(409, "Esta tarefa já foi concluída. Recarregue a tela.")
    }

    // Responsáveis só da equipe do escritório.
    const equipe = await usuariosDoFluxo()
    const daEquipe = new Set(equipe.map((u) => u.id))
    const pedidos =
      "responsaveis" in acao && Array.isArray(acao.responsaveis)
        ? acao.responsaveis
        : acao.acao === "concluirParte" && acao.responsavelId
          ? [acao.responsavelId]
          : []
    if (pedidos.some((r) => !daEquipe.has(r))) return erro(400, "Responsável fora da equipe do escritório")

    // Entra no fluxo pela pasta, se ainda não entrou. Só nesse caso é
    // preciso saber se ela nasceu de intimação.
    const lugar: TarefaComLugar = {
      id: tarefa.id,
      setor: tarefa.setor,
      pasta: tarefa.pasta,
      titulo: tarefa.titulo,
      tipo: tarefa.tipo,
      status: tarefa.status,
      responsavelId: tarefa.responsavel_id,
    }
    await garantirNoFluxo(lugar, user.id, async () =>
      linhasPelaPasta({ ...lugar, deIntimacao: await nasceuDeIntimacao(tarefa.id) })
    )

    let efeito = 0
    const rpc = async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn, args)
      if (error) throw error
      return Number(data ?? 0)
    }

    switch (acao.acao) {
      case "mover": {
        const responsaveis =
          acao.responsaveis === undefined
            ? acao.para.etapa
              ? responsaveisPadrao(acao.para.etapa, equipe)
              : null
            : acao.responsaveis
        efeito = await rpc("fluxo_mover", {
          p_tarefa: id,
          p_de_setor: acao.de.setor,
          p_de_etapa: acao.de.etapa,
          p_para_setor: acao.para.setor,
          p_para_etapa: acao.para.etapa,
          p_responsaveis: responsaveis,
          p_usuario: user.id,
        })
        if (efeito === 0) return erro(409, "A tarefa já não está nessa etapa — alguém mexeu antes. A tela foi atualizada.")
        break
      }

      case "adicionar": {
        const responsaveis =
          acao.responsaveis ?? (acao.para.etapa ? responsaveisPadrao(acao.para.etapa, equipe) : null) ?? []
        efeito = await rpc("fluxo_adicionar", {
          p_tarefa: id,
          p_para_setor: acao.para.setor,
          p_para_etapa: acao.para.etapa,
          p_responsaveis: responsaveis,
          p_usuario: user.id,
        })
        break
      }

      case "concluirParte": {
        efeito = await rpc("fluxo_concluir_parte", {
          p_tarefa: id,
          p_setor: acao.em.setor,
          p_etapa: acao.em.etapa,
          p_responsavel: acao.responsavelId,
          p_usuario: user.id,
        })
        if (efeito === 0) return erro(409, "Essa parte já tinha sido concluída. A tela foi atualizada.")
        break
      }

      case "concluirEtapa": {
        efeito = await rpc("fluxo_concluir_etapa", {
          p_tarefa: id,
          p_setor: acao.em.setor,
          p_etapa: acao.em.etapa,
          p_usuario: user.id,
        })
        if (efeito === 0) return erro(409, "A tarefa já não está nessa etapa. A tela foi atualizada.")
        break
      }

      case "responsaveis": {
        efeito = await rpc("fluxo_responsaveis", {
          p_tarefa: id,
          p_setor: acao.em.setor,
          p_etapa: acao.em.etapa,
          p_responsaveis: acao.responsaveis,
          p_usuario: user.id,
        })
        if (efeito === 0) return erro(409, "A tarefa já não está nessa etapa. A tela foi atualizada.")
        break
      }

      case "concluirMinhaParte": {
        // Para quem conclui de fora das telas dos times (agenda, quadro
        // geral, conector do Claude): fecha só o que é da pessoa. Se a
        // tarefa tem outros responsáveis, ela continua aberta para eles —
        // menos na etapa em que basta um (a entrega do rosa): ali quem
        // conclui encerra a etapa para todos.
        const abertas = (await atribuicoesDaTarefa(id)).filter((a) => !a.fimEm)
        const minhas = abertas.filter((a) => a.responsavelId === user.id)
        const lugares = new Set(abertas.map((a) => `${a.setor}|${a.etapa ?? ""}`))
        const umLugarBastaUm = lugares.size === 1 && etapaBastaUm(abertas[0]?.etapa)
        const alvo = minhas.length ? minhas : abertas.length === 1 || umLugarBastaUm ? abertas : []
        if (!alvo.length) {
          const nomes = [...new Set(abertas.map((a) => equipe.find((u) => u.id === a.responsavelId)?.name ?? "sem responsável"))]
          return erro(
            409,
            `Esta tarefa está com mais de um responsável (${nomes.join(", ")}). Conclua a parte certa pela tela do time.`
          )
        }
        const etapasEncerradas = new Set<string>()
        for (const a of alvo) {
          if (etapaBastaUm(a.etapa)) {
            const chave = `${a.setor}|${a.etapa}`
            if (etapasEncerradas.has(chave)) continue
            etapasEncerradas.add(chave)
            efeito += await rpc("fluxo_concluir_etapa", {
              p_tarefa: id,
              p_setor: a.setor,
              p_etapa: a.etapa,
              p_usuario: user.id,
            })
            continue
          }
          efeito += await rpc("fluxo_concluir_parte", {
            p_tarefa: id,
            p_setor: a.setor,
            p_etapa: a.etapa,
            p_responsavel: a.responsavelId,
            p_usuario: user.id,
          })
        }
        break
      }
    }

    const { data: depois, error: erroDepois } = await supabase
      .from("tarefas")
      .select("*, processo:processos(beneficio, numero), responsavel:users!tarefas_responsavel_id_fkey(id, name)")
      .eq("id", id)
      .maybeSingle()
    if (erroDepois) throw erroDepois

    const resposta = toCamelCase(depois ?? {}) as Record<string, unknown>
    resposta.atribuicoes = await atribuicoesDaTarefa(id)
    return { status: 200, corpo: { efeito, tarefa: resposta } }
  } catch (falha) {
    const e = falha as ErroBanco
    if (faltaMigration(e)) return erro(503, MENSAGEM_SEM_MIGRATION)
    if (e?.code === "P0002") return erro(404, "Tarefa não encontrada")
    // Pedido que o banco recusou por regra (etapa inválida, valor fora
    // do enum): é erro de quem pediu, não do servidor.
    if (e?.code === "22P02" || e?.code === "23514" || e?.code === "23503") {
      return erro(400, "O banco recusou a mudança: dados fora das regras do fluxo.")
    }
    console.error("Fluxo da tarefa:", e?.message ?? falha)
    return erro(500, "Erro interno do servidor")
  }
}

// ── Dúvidas ───────────────────────────────────────────────

/**
 * Abrir uma dúvida a partir de uma tarefa.
 *
 * O que nasce aqui é uma tarefa de verdade, filha da que a originou:
 * entra no quadro, tem responsável e prazo. Guardar a pergunta num
 * campo de texto da tarefa mãe esconderia justamente o que precisa
 * aparecer — que existe trabalho parado esperando resposta.
 *
 * Herdar o time e o processo da mãe não é comodidade: a dúvida sobre a
 * pasta da Maria é trabalho da mesma equipe e do mesmo caso, e obrigar
 * quem pergunta a repetir isso é como o formulário aprende a ser
 * ignorado.
 */
export async function abrirDuvida(user: CurrentUser, id: string, body: unknown): Promise<Resultado> {
  const parsed = DuvidaSchema.safeParse(body)
  if (!parsed.success) return erro(400, parsed.error.issues[0]?.message ?? "Dados inválidos")

  const { data: mae } = await supabase
    .from("tarefas")
    .select("id, tipo, setor, processo_id, responsavel_id, data")
    .eq("id", id)
    .in("user_id", await idsDoEscritorio())
    .maybeSingle()

  if (!mae) return erro(404, "Tarefa não encontrada")

  // O fio precisa ter fim: quem tem dúvida sobre a resposta pergunta
  // de novo na tarefa principal. Sem isto, "abrir a tarefa e ver as
  // perguntas dela" viraria uma árvore que ninguém lê. O banco não
  // consegue conferir isto sozinho — o CHECK não enxerga a linha da
  // mãe —, então a regra mora aqui.
  if (mae.tipo === "DUVIDA") {
    return erro(400, "Uma dúvida não abre outra dúvida. Pergunte na tarefa principal.")
  }

  const { data: duvida, error } = await supabase
    .from("tarefas")
    .insert({
      user_id: user.id,
      titulo: parsed.data.pergunta,
      tipo: "DUVIDA",
      tarefa_pai_id: mae.id,
      // Da mãe: mesma equipe, mesmo caso.
      setor: mae.setor,
      processo_id: mae.processo_id,
      responsavel_id: parsed.data.responsavelId ?? mae.responsavel_id,
      data: parsed.data.data ?? mae.data,
      prioridade: parsed.data.prioridade ?? "MEDIA",
    })
    .select("*, responsavel:users!tarefas_responsavel_id_fkey(id, name)")
    .single()

  if (error || !duvida) {
    console.error("Abrir dúvida error:", error?.message)
    return erro(500, "Erro interno do servidor")
  }

  // O evento vai no clone, não na mãe: uma linha só, num lugar só. A
  // tela da tarefa principal alcança as perguntas pelo laço
  // `tarefa_pai_id`, sem uma segunda cópia para discordar da primeira.
  const { error: erroEvento } = await supabase.from("eventos_tarefa").insert({
    tarefa_id: duvida.id,
    tipo: "DUVIDA_ABERTA",
    autor_id: user.id,
    texto: parsed.data.pergunta,
  })

  if (erroEvento) {
    // A dúvida existe; o registro dela não. Some do histórico e some
    // silenciosamente — por isso o log, e por isso não devolvemos 500:
    // desfazer agora deixaria a pessoa sem a dúvida que ela abriu.
    console.error("Evento da dúvida não gravado:", erroEvento.message)
  }

  return { status: 201, corpo: { duvida: toCamelCase(duvida) } }
}

// ── Leitura ───────────────────────────────────────────────

/**
 * As tarefas abertas do escritório, cada uma com as atribuições (as
 * gravadas, ou nenhuma — quem lê calcula pela pasta) e com a marca de
 * que nasceu de intimação. É o que as telas dos times recebem.
 */
export async function tarefasAbertasComFluxo(): Promise<Record<string, unknown>[]> {
  const escritorio = await idsDoEscritorio()
  const PAGINA = 1000
  const linhas: Record<string, unknown>[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from("tarefas")
      .select("*, processo:processos(beneficio, numero), responsavel:users!tarefas_responsavel_id_fkey(id, name)")
      .in("user_id", escritorio)
      .not("status", "in", "(CONCLUIDA,CANCELADA)")
      .order("data", { ascending: true })
      .order("id", { ascending: true })
      .range(de, de + PAGINA - 1)
    if (error) throw error
    linhas.push(...(data ?? []))
    if (!data || data.length < PAGINA) break
  }

  const deIntimacao = await tarefasDeIntimacao(escritorio)
  const porTarefa = (await fluxoDisponivel())
    ? await atribuicoesParaTela(new Set(linhas.map((t) => String(t.id))))
    : new Map()

  return linhas.map((t) => {
    const tarefa = toCamelCase(t) as Record<string, unknown>
    tarefa.deIntimacao = deIntimacao.has(String(t.id))
    tarefa.atribuicoes = porTarefa.get(String(t.id)) ?? []
    return tarefa
  })
}
