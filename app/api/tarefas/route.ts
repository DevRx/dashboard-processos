import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { TarefaCriacaoSchema } from "@/lib/validators"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase, toSnakeCase } from "@/lib/utils"
import { idsDoEscritorio } from "@/lib/escritorio"
import {
  atribuicoesDaTarefa,
  atribuicoesParaTela,
  faltaMigration,
  fluxoDisponivel,
  garantirNoFluxo,
  tarefasDeIntimacao,
  usuariosDoFluxo,
} from "@/lib/fluxo/servidor"
import { etapaDaTarefa, responsaveisPadrao, ETAPAS, type LinhaFluxo } from "@/lib/domain/tarefa"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const processoId = searchParams.get("processoId")
    // O quadro só mostra o que falta fazer. Com o histórico do TickTick
    // são milhares de concluídas, e mandá-las para a tela só para ela
    // jogar fora é o que deixava o quadro lento.
    const soAbertas = searchParams.get("abertas") === "1"
    const escritorio = await idsDoEscritorio()

    // O Supabase devolve no máximo mil linhas por consulta, em silêncio.
    // Sem paginar, o escritório com 5 mil tarefas via as mil mais antigas
    // — justamente as já concluídas — e nenhuma das que estão em aberto.
    const PAGINA = 1000
    const tarefas: Record<string, unknown>[] = []
    for (let de = 0; ; de += PAGINA) {
      let query = supabase
        .from("tarefas")
        .select(
          "*, processo:processos(beneficio, numero), responsavel:users!tarefas_responsavel_id_fkey(id, name)"
        )
        .in("user_id", escritorio)
        .order("data", { ascending: true })
        .order("id", { ascending: true })
        .range(de, de + PAGINA - 1)

      if (processoId) query = query.eq("processo_id", processoId)
      if (soAbertas) query = query.not("status", "in", "(CONCLUIDA,CANCELADA)")

      const { data, error } = await query

      if (error) {
        console.error("Get tarefas error:", error)
        return NextResponse.json(
          { error: "Erro interno do servidor" },
          { status: 500 }
        )
      }

      tarefas.push(...(data ?? []))
      if (!data || data.length < PAGINA) break
    }

    // A agenda precisa saber quais tarefas nasceram de uma intimação:
    // são os prazos do calendário de perícias e prazos. O vínculo mora
    // na intimação (`comunicacoes_djen.tarefa_id`), não na tarefa.
    if (searchParams.get("vinculos") === "1") {
      const deIntimacao = await tarefasDeIntimacao(escritorio)
      for (const t of tarefas) {
        t.de_intimacao = deIntimacao.has(String(t.id))
      }
    }

    // As telas dos times precisam de onde cada tarefa está no fluxo e
    // com quem. Sem a migration, as tarefas vêm sem atribuições e a tela
    // segue as pastas do TickTick.
    let fluxo: { disponivel: boolean } | undefined
    if (searchParams.get("atribuicoes") === "1") {
      const disponivel = await fluxoDisponivel()
      fluxo = { disponivel }
      if (disponivel) {
        const porTarefa = await atribuicoesParaTela(new Set(tarefas.map((t) => String(t.id))))
        for (const t of tarefas) {
          t.atribuicoes = porTarefa.get(String(t.id)) ?? []
        }
      }
    }

    // `atribuicoes` já vem em camelCase; o resto da linha, não.
    const resposta = tarefas.map((t) => {
      const { atribuicoes, ...resto } = t
      const tarefa = toCamelCase(resto) as Record<string, unknown>
      if (atribuicoes !== undefined) tarefa.atribuicoes = atribuicoes
      return tarefa
    })

    return NextResponse.json({ tarefas: resposta, ...(fluxo ? { fluxo } : {}) }, { status: 200 })
  } catch (error) {
    console.error("Get tarefas error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()

    const validatedFields = TarefaCriacaoSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    // A etapa e os responsáveis não são colunas da tarefa: vão para as
    // atribuições, depois de gravada a tarefa.
    const { etapa, responsaveis, ...campos } = validatedFields.data
    if (etapa) {
      if (campos.setor && campos.setor !== ETAPAS[etapa].time) {
        return NextResponse.json({ error: "A etapa não é deste time" }, { status: 400 })
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
      return NextResponse.json({ error: "Responsável fora da equipe do escritório" }, { status: 400 })
    }

    // Verify the processo belongs to this user (if processoId is provided)
    if (validatedFields.data.processoId) {
      const { data: processo, error: processoError } = await supabase
        .from("processos")
        .select("id")
        .eq("id", validatedFields.data.processoId)
        .in("user_id", await idsDoEscritorio())
        .single()

      if (processoError || !processo) {
        return NextResponse.json(
          { error: "Processo não encontrado ou não autorizado" },
          { status: 404 }
        )
      }
    }

    const { data: tarefa, error } = await supabase
      .from("tarefas")
      .insert({
        ...toSnakeCase(campos),
        user_id: user.id,
      })
      .select("*, responsavel:users!tarefas_responsavel_id_fkey(id, name)")
      .single()

    if (error || !tarefa) {
      console.error("Create tarefa error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
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

    return NextResponse.json(
      { message: "Tarefa criada com sucesso", tarefa: resposta },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create tarefa error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
