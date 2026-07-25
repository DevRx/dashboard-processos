import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { AndamentoSchema } from "@/lib/validators"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase, toSnakeCase } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const processoId = searchParams.get("processoId")

    let query = supabase
      .from("andamentos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (processoId) {
      query = query.eq("processo_id", processoId)
    }

    const { data: andamentos, error } = await query

    if (error) {
      console.error("Get andamentos error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { andamentos: toCamelCase(andamentos) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get andamentos error:", error)
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

    const validatedFields = AndamentoSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    // Verify the processo belongs to this user
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

    const { data: andamento, error } = await supabase
      .from("andamentos")
      .insert({
        ...toSnakeCase(validatedFields.data),
        user_id: user.id,
      })
      .select()
      .single()

    if (error || !andamento) {
      console.error("Create andamento error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Andamento criado com sucesso", andamento: toCamelCase(andamento) },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create andamento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
