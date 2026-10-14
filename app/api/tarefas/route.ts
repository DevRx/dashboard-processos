import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase } from "@/lib/utils"
import { idsDoEscritorio } from "@/lib/escritorio"
import { atribuicoesParaTela, fluxoDisponivel, tarefasDeIntimacao } from "@/lib/fluxo/servidor"
import { criarTarefa } from "@/lib/tarefas/servico"

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

    // A regra de criar (etapa, responsáveis, entrada no fluxo) mora em
    // lib/tarefas/servico.ts — a mesma que o conector do Claude usa.
    const r = await criarTarefa(user, await request.json())
    return NextResponse.json(r.corpo, { status: r.status })
  } catch (error) {
    console.error("Create tarefa error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
