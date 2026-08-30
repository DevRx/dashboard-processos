import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { TarefaSchema, TarefaPatchSchema } from "@/lib/validators"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase, toSnakeCase } from "@/lib/utils"
import { idsDoEscritorio } from "@/lib/escritorio"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const { data: tarefa, error } = await supabase
      .from("tarefas")
      .select("*, processo:processos(beneficio, numero)")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .single()

    if (error || !tarefa) {
      return NextResponse.json(
        { error: "Tarefa não encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { tarefa: toCamelCase(tarefa) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get tarefa error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const validatedFields = TarefaSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { data: tarefa, error } = await supabase
      .from("tarefas")
      .update(toSnakeCase(validatedFields.data))
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .select()
      .single()

    if (error || !tarefa) {
      console.error("Update tarefa error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Tarefa atualizada com sucesso", tarefa: toCamelCase(tarefa) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update tarefa error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

/**
 * Edição pontual, usada pelo quadro de tarefas: trocar setor, passar
 * para outro responsável, mudar o status. O PUT acima continua sendo o
 * caminho do formulário completo.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const parsed = TarefaPatchSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      )
    }

    const doEscritorio = await idsDoEscritorio()

    // O status de antes, lido antes de escrever: é a metade do evento
    // que deixa de existir depois do UPDATE. Só é buscado quando o
    // PATCH mexe em status — trocar o time não vira histórico.
    let statusAntes: string | null = null
    if (parsed.data.status !== undefined) {
      const { data: anterior } = await supabase
        .from("tarefas")
        .select("status")
        .eq("id", id)
        .in("user_id", doEscritorio)
        .maybeSingle()
      statusAntes = anterior?.status ?? null
    }

    const { data: tarefa, error } = await supabase
      .from("tarefas")
      .update(toSnakeCase(parsed.data))
      .eq("id", id)
      .in("user_id", doEscritorio)
      .select("*, responsavel:users!tarefas_responsavel_id_fkey(id, name)")
      .maybeSingle()

    if (error || !tarefa) {
      console.error("Patch tarefa error:", error?.message)
      return NextResponse.json(
        { error: "Tarefa não encontrada" },
        { status: 404 }
      )
    }

    // Status que não mudou não é evento: marcar "concluída" numa tarefa
    // já concluída encheria o histórico de linhas que não aconteceram.
    if (parsed.data.status !== undefined && parsed.data.status !== statusAntes) {
      const { error: erroEvento } = await supabase
        .from("eventos_tarefa")
        .insert({
          tarefa_id: id,
          tipo: "STATUS_ALTERADO",
          autor_id: user.id,
          status_de: statusAntes,
          status_para: parsed.data.status,
        })

      // A edição valeu; o registro dela não. Não vira 500: devolver
      // erro aqui faria a tela desfazer uma mudança que o banco já tem.
      if (erroEvento) {
        console.error("Evento de status não gravado:", erroEvento.message)
      }
    }

    return NextResponse.json({ tarefa: toCamelCase(tarefa) }, { status: 200 })
  } catch (error) {
    console.error("Patch tarefa error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const { error } = await supabase
      .from("tarefas")
      .delete()
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())

    if (error) {
      console.error("Delete tarefa error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Tarefa excluída com sucesso" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete tarefa error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
