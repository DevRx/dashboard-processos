import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { TarefaSchema } from "@/lib/validators"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase, toSnakeCase } from "@/lib/utils"
import { idsDoEscritorio } from "@/lib/escritorio"

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

    return NextResponse.json(
      { tarefas: toCamelCase(tarefas) },
      { status: 200 }
    )
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

    const validatedFields = TarefaSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
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
        ...toSnakeCase(validatedFields.data),
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

    return NextResponse.json(
      { message: "Tarefa criada com sucesso", tarefa: toCamelCase(tarefa) },
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
