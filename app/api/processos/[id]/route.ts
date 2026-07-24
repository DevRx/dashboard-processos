import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ProcessoSchema } from "@/lib/validations"
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

    const processo = await db.processo.findUnique({
      where: { id },
      include: { cliente: true },
    })

    if (!processo) {
      return NextResponse.json(
        { error: "Processo não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ processo }, { status: 200 })
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

    const processo = await db.processo.update({
      where: { id },
      data: validatedFields.data,
    })

    return NextResponse.json(
      { message: "Processo atualizado com sucesso", processo },
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

    await db.processo.delete({
      where: { id },
    })

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
