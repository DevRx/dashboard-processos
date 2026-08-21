import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { RegisterSchema } from "@/lib/validators"

/**
 * Criar conta deixou de ser público.
 *
 * Enquanto cada pessoa via apenas o que ela mesma cadastrou, um
 * cadastro aberto custava pouco: o desconhecido entrava numa conta
 * vazia. Agora que a carteira é do escritório, a mesma porta entrega
 * CPF, laudo médico e consentimento de todos os clientes a quem
 * preencher um formulário. Quem admite alguém no escritório passa a ser
 * o ADMIN.
 *
 * A exceção é a instalação vazia: sem nenhum usuário no banco, exigir
 * um ADMIN logado trancaria o sistema por fora. O primeiro cadastro
 * abre a porta e a fecha atrás de si.
 */
export async function POST(request: NextRequest) {
  try {
    const total = await prisma.user.count()

    if (total > 0) {
      const atual = await getCurrentUser()

      if (!atual) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      }

      if (atual.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Apenas um administrador cadastra novas pessoas" },
          { status: 403 }
        )
      }
    }

    const body = await request.json()

    const validatedFields = RegisterSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { name, email, password, role } = validatedFields.data

    const existingUser = await prisma.user.findUnique({ where: { email } })

    if (existingUser) {
      return NextResponse.json(
        { error: "E-mail já cadastrado" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "USER",
      },
      select: { id: true, name: true, email: true, role: true },
    })

    return NextResponse.json(
      { message: "Usuário criado com sucesso", user },
      { status: 201 }
    )
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
