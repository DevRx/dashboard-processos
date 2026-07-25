import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { ProcessoSchema } from "@/lib/validations"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase } from "@/lib/utils"

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

    const { data: processo, error } = await supabase
      .from("processos")
      .select("*, cliente(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error || !processo) {
      return NextResponse.json(
        { error: "Processo não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ processo: toCamelCase(processo) }, { status: 200 })
  } catch (error) {
    console.error("Get processo error:", error)
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

    const validatedFields = ProcessoSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { data: processo, error } = await supabase
      .from("processos")
      .update(validatedFields.data)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !processo) {
      console.error("Update processo error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Processo atualizado com sucesso", processo: toCamelCase(processo) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update processo error:", error)
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
      .from("processos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      console.error("Delete processo error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Processo excluído com sucesso" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete processo error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
