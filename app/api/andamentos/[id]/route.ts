import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { AndamentoSchema } from "@/lib/validators"
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

    const { data: andamento, error } = await supabase
      .from("andamentos")
      .select("*")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .single()

    if (error || !andamento) {
      return NextResponse.json(
        { error: "Andamento não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { andamento: toCamelCase(andamento) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get andamento error:", error)
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

    const validatedFields = AndamentoSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { data: andamento, error } = await supabase
      .from("andamentos")
      .update(toSnakeCase(validatedFields.data))
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .select()
      .single()

    if (error || !andamento) {
      console.error("Update andamento error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Andamento atualizado com sucesso", andamento: toCamelCase(andamento) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update andamento error:", error)
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
      .from("andamentos")
      .delete()
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())

    if (error) {
      console.error("Delete andamento error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Andamento excluído com sucesso" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete andamento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
