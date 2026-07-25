import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { LancamentoFinanceiroSchema } from "@/lib/validations"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase, toSnakeCase } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get("tipo")

    let query = supabase
      .from("lancamentos_financeiros")
      .select("*")
      .eq("user_id", user.id)
      .order("data", { ascending: false })

    if (tipo) {
      query = query.eq("tipo", tipo)
    }

    const { data: lancamentos, error } = await query

    if (error) {
      console.error("Get lancamentos error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { lancamentos: toCamelCase(lancamentos) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get lancamentos error:", error)
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

    const validatedFields = LancamentoFinanceiroSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { data: lancamento, error } = await supabase
      .from("lancamentos_financeiros")
      .insert({
        ...toSnakeCase(validatedFields.data),
        user_id: user.id,
      })
      .select()
      .single()

    if (error || !lancamento) {
      console.error("Create lancamento error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Lançamento criado com sucesso", lancamento: toCamelCase(lancamento) },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create lancamento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
