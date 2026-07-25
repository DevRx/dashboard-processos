import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { ClienteSchema } from "@/lib/validations"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase, toSnakeCase } from "@/lib/utils"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { data: clientes, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Get clientes error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json({ clientes: toCamelCase(clientes) }, { status: 200 })
  } catch (error) {
    console.error("Get clientes error:", error)
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
      .insert({
        ...toSnakeCase(validatedFields.data),
        user_id: user.id,
      })
      .select()
      .single()

    if (error || !cliente) {
      console.error("Create cliente error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Cliente criado com sucesso", cliente: toCamelCase(cliente) },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create cliente error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
