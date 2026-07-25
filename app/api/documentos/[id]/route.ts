import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { DocumentoSchema } from "@/lib/validations"
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

    const { data: documento, error } = await supabase
      .from("documentos")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error || !documento) {
      return NextResponse.json(
        { error: "Documento não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { documento: toCamelCase(documento) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get documento error:", error)
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

    const validatedFields = DocumentoSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { data: documento, error } = await supabase
      .from("documentos")
      .update(validatedFields.data)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !documento) {
      console.error("Update documento error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Documento atualizado com sucesso", documento: toCamelCase(documento) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update documento error:", error)
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
      .from("documentos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      console.error("Delete documento error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Documento excluído com sucesso" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete documento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
