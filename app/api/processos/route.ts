import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ProcessoSchema } from "@/lib/validations"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const processos = await db.processo.findMany({
      include: {
        cliente: {
          select: { nome: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ processos }, { status: 200 })
  } catch (error) {
    console.error("Get processos error:", error)
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

    const validatedFields = ProcessoSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const processo = await db.processo.create({
      data: validatedFields.data,
    })

    return NextResponse.json(
      { message: "Processo criado com sucesso", processo },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create processo error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
