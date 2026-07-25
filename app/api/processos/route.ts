import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { ProcessoSchema } from "@/lib/validations"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase, toSnakeCase } from "@/lib/utils"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { data: processos, error } = await supabase
      .from("processos")
      .select("*, cliente:clientes(nome)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Get processos error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json({ processos: toCamelCase(processos) }, { status: 200 })
  } catch (error) {
    console.error("Get processos error:", error)
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

    const validatedFields = ProcessoSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    // Verify the cliente belongs to this user
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", validatedFields.data.clienteId)
      .eq("user_id", user.id)
      .single()

    if (clienteError || !cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado ou não autorizado" },
        { status: 404 }
      )
    }

    const { data: processo, error } = await supabase
      .from("processos")
      .insert({
        ...toSnakeCase(validatedFields.data),
        user_id: user.id,
      })
      .select()
      .single()

    if (error || !processo) {
      console.error("Create processo error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Processo criado com sucesso", processo: toCamelCase(processo) },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create processo error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
