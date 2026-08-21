import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { DocumentoSchema } from "@/lib/validators"
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

    const { data: documento, error } = await supabase
      .from("documentos")
      .select("*")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
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
      .update(toSnakeCase(validatedFields.data))
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
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

    // Levanta o caminho antes de apagar a linha: depois não há como
    // saber qual arquivo remover, e ele ficaria órfão no bucket — dado
    // pessoal fora do alcance de qualquer expurgo.
    const { data: documento } = await supabase
      .from("documentos")
      .select("caminho")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .maybeSingle()

    const { error } = await supabase
      .from("documentos")
      .delete()
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())

    if (!error && documento?.caminho) {
      const { error: erroStorage } = await supabase.storage
        .from("documentos")
        .remove([documento.caminho])
      if (erroStorage) {
        console.error(
          "Delete documento: arquivo não removido do storage",
          erroStorage.message
        )
      }
    }

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
