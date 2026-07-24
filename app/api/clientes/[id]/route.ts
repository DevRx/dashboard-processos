import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ClienteSchema } from "@/lib/validations"
import { getCurrentUser } from "@/lib/auth"

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

    const cliente = await db.cliente.findUnique({
      where: { id },
      include: { processos: true },
    })

    if (!cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ cliente }, { status: 200 })
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

    const cliente = await db.cliente.update({
      where: { id },
      data: validatedFields.data,
    })

    return NextResponse.json(
      { message: "Cliente atualizado com sucesso", cliente },
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

    await db.cliente.delete({
      where: { id },
    })

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
