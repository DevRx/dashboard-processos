import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { ClienteSchema } from "@/lib/validators"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase, toSnakeCase } from "@/lib/utils"

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

    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("*, processos(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error || !cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ cliente: toCamelCase(cliente) }, { status: 200 })
  } catch (error) {
    console.error("Get cliente error:", error)
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

    const validatedFields = ClienteSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { data: cliente, error } = await supabase
      .from("clientes")
      .update(toSnakeCase(validatedFields.data))
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !cliente) {
      console.error("Update cliente error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Cliente atualizado com sucesso", cliente: toCamelCase(cliente) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update cliente error:", error)
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

    // O cascade do banco apaga as linhas, mas não alcança o bucket: os
    // PDFs de procuração ficariam órfãos no storage, dado pessoal fora
    // do alcance de qualquer expurgo. Levantar os caminhos antes é a
    // única chance de removê-los.
    const { data: procuracoes } = await supabase
      .from("consentimentos_lgpd")
      .select("procuracao_arquivo")
      .eq("cliente_id", id)
      .eq("user_id", user.id)
      .not("procuracao_arquivo", "is", null)

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (!error && procuracoes?.length) {
      const caminhos = procuracoes
        .map((p) => p.procuracao_arquivo as string)
        .filter(Boolean)
      const { error: erroStorage } = await supabase.storage
        .from("procuracoes")
        .remove(caminhos)
      // Falha aqui não desfaz a exclusão — o cliente já saiu do banco.
      // Mas precisa aparecer no log, senão o arquivo fica esquecido.
      if (erroStorage) {
        console.error(
          "Delete cliente: procurações não removidas do storage",
          erroStorage.message
        )
      }
    }

    if (error) {
      console.error("Delete cliente error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Cliente excluído com sucesso" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete cliente error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
