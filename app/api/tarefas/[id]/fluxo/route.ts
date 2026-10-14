import { NextRequest, NextResponse } from "next/server"

import { supabase } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth"
import { idsDoEscritorio } from "@/lib/escritorio"
import { toCamelCase } from "@/lib/utils"
import { AcaoFluxoSchema } from "@/lib/validators"
import { etapaBastaUm, linhasPelaPasta, responsaveisPadrao, type TarefaComLugar } from "@/lib/domain/tarefa"
import {
  MENSAGEM_SEM_MIGRATION,
  atribuicoesDaTarefa,
  faltaMigration,
  fluxoDisponivel,
  garantirNoFluxo,
  usuariosDoFluxo,
} from "@/lib/fluxo/servidor"

/** Esta tarefa foi aberta por uma intimação do DJEN? */
async function nasceuDeIntimacao(tarefaId: string) {
  const { data } = await supabase.from("comunicacoes_djen").select("id").eq("tarefa_id", tarefaId).limit(1)
  return Boolean(data?.length)
}

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

type Erro = { code?: string | null; message?: string | null; details?: string | null }

function falha(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return falha(401, "Não autorizado")

  const { id } = await params
  const parsed = AcaoFluxoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return falha(400, parsed.error.issues[0]?.message ?? "Dados inválidos")
  const acao = parsed.data

  try {
    if (!(await fluxoDisponivel())) return falha(503, MENSAGEM_SEM_MIGRATION)

    const escritorio = await idsDoEscritorio()
    const { data: tarefa, error: erroTarefa } = await supabase
      .from("tarefas")
      .select("id, setor, pasta, titulo, tipo, status, responsavel_id, created_at")
      .eq("id", id)
      .in("user_id", escritorio)
      .maybeSingle()

    if (erroTarefa) throw erroTarefa
    if (!tarefa) return falha(404, "Tarefa não encontrada")
    if (tarefa.status === "CONCLUIDA" || tarefa.status === "CANCELADA") {
      return falha(409, "Esta tarefa já foi concluída. Recarregue a tela.")
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
    if (pedidos.some((r) => !daEquipe.has(r))) return falha(400, "Responsável fora da equipe do escritório")

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
        if (efeito === 0) return falha(409, "A tarefa já não está nessa etapa — alguém mexeu antes. A tela foi atualizada.")
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
        if (efeito === 0) return falha(409, "Essa parte já tinha sido concluída. A tela foi atualizada.")
        break
      }

      case "concluirEtapa": {
        efeito = await rpc("fluxo_concluir_etapa", {
          p_tarefa: id,
          p_setor: acao.em.setor,
          p_etapa: acao.em.etapa,
          p_usuario: user.id,
        })
        if (efeito === 0) return falha(409, "A tarefa já não está nessa etapa. A tela foi atualizada.")
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
        if (efeito === 0) return falha(409, "A tarefa já não está nessa etapa. A tela foi atualizada.")
        break
      }

      case "concluirMinhaParte": {
        // Para quem conclui de fora das telas dos times (agenda, quadro
        // geral): fecha só o que é da pessoa. Se a tarefa tem outros
        // responsáveis, ela continua aberta para eles — menos na etapa em
        // que basta um (a entrega do rosa): ali quem conclui encerra a
        // etapa para todos.
        const abertas = (await atribuicoesDaTarefa(id)).filter((a) => !a.fimEm)
        const minhas = abertas.filter((a) => a.responsavelId === user.id)
        const lugares = new Set(abertas.map((a) => `${a.setor}|${a.etapa ?? ""}`))
        const umLugarBastaUm = lugares.size === 1 && etapaBastaUm(abertas[0]?.etapa)
        const alvo = minhas.length ? minhas : abertas.length === 1 || umLugarBastaUm ? abertas : []
        if (!alvo.length) {
          const nomes = [...new Set(abertas.map((a) => equipe.find((u) => u.id === a.responsavelId)?.name ?? "sem responsável"))]
          return falha(
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
    return NextResponse.json({ efeito, tarefa: resposta }, { status: 200 })
  } catch (erro) {
    const e = erro as Erro
    if (faltaMigration(e)) return falha(503, MENSAGEM_SEM_MIGRATION)
    if (e?.code === "P0002") return falha(404, "Tarefa não encontrada")
    // Pedido que o banco recusou por regra (etapa inválida, valor fora
    // do enum): é erro de quem pediu, não do servidor.
    if (e?.code === "22P02" || e?.code === "23514" || e?.code === "23503") {
      return falha(400, "O banco recusou a mudança: dados fora das regras do fluxo.")
    }
    console.error("Fluxo da tarefa:", e?.message ?? erro)
    return falha(500, "Erro interno do servidor")
  }
}
