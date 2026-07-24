import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ClienteSchema } from "@/lib/validations"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const clientes = await db.cliente.findMany({
      include: {
        _count: {
          select: { processos: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ clientes }, { status: 200 })
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

    const cliente = await db.cliente.create({
      data: validatedFields.data,
    })

    return NextResponse.json(
      { message: "Cliente criado com sucesso", cliente },
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
