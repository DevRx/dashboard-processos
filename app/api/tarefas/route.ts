import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { TarefaSchema } from "@/lib/validations"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const processoId = searchParams.get("processoId")

    let query = supabase
      .from("tarefas")
      .select("*, processo(beneficio, numero)")
      .eq("user_id", user.id)
      .order("data", { ascending: true })

    if (processoId) {
      query = query.eq("processo_id", processoId)
    }

    const { data: tarefas, error } = await query

    if (error) {
      console.error("Get tarefas error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
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
        .eq("user_id", user.id)
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
        ...validatedFields.data,
        user_id: user.id,
      })
      .select()
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
