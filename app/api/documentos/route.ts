import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { DocumentoSchema } from "@/lib/validators"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase, toSnakeCase } from "@/lib/utils"
import { idsDoEscritorio } from "@/lib/escritorio"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const processoId = searchParams.get("processoId")
    const clienteId = searchParams.get("clienteId")

    let query = supabase
      .from("documentos")
      .select("*")
      .in("user_id", await idsDoEscritorio())
      .order("created_at", { ascending: false })

    // Por cliente é a visão da pasta completa; por processo, o recorte
    // do que pertence a um pedido específico.
    if (clienteId) {
      query = query.eq("cliente_id", clienteId)
    }

    if (processoId) {
      query = query.eq("processo_id", processoId)
    }

    const { data: documentos, error } = await query

    if (error) {
      console.error("Get documentos error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { documentos: toCamelCase(documentos) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get documentos error:", error)
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

    const validatedFields = DocumentoSchema.safeParse(body)

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
      .in("user_id", await idsDoEscritorio())
      .single()

    if (processoError || !processo) {
      return NextResponse.json(
        { error: "Processo não encontrado ou não autorizado" },
        { status: 404 }
      )
    }

    const { data: documento, error } = await supabase
      .from("documentos")
      .insert({
        ...toSnakeCase(validatedFields.data),
        user_id: user.id,
      })
      .select()
      .single()

    if (error || !documento) {
      console.error("Create documento error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Documento criado com sucesso", documento: toCamelCase(documento) },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create documento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
