import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { LancamentoFinanceiroSchema } from "@/lib/validators"
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

    const { data: lancamento, error } = await supabase
      .from("lancamentos_financeiros")
      .select("*")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .single()

    if (error || !lancamento) {
      return NextResponse.json(
        { error: "Lançamento não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { lancamento: toCamelCase(lancamento) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get lancamento error:", error)
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
      .update(toSnakeCase(validatedFields.data))
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .select()
      .single()

    if (error || !lancamento) {
      console.error("Update lancamento error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Lançamento atualizado com sucesso", lancamento: toCamelCase(lancamento) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update lancamento error:", error)
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
      .from("lancamentos_financeiros")
      .delete()
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())

    if (error) {
      console.error("Delete lancamento error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Lançamento excluído com sucesso" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete lancamento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
