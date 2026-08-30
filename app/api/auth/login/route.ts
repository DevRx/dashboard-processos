import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { supabase } from "@/lib/supabase/server"
import { LoginSchema } from "@/lib/validators"
import { createSession } from "@/lib/session"

/**
 * Entrar.
 *
 * Fala com o Supabase como todo o resto do sistema. Já falou com o
 * Prisma, por conexão direta ao Postgres, e isso custava caro de um
 * jeito difícil de enxergar: o Prisma pede `DATABASE_URL`, que nenhuma
 * outra rota usa, e `prisma generate` na build não reclama da falta
 * dela. O deploy subia verde e morria na porta da frente — "erro
 * interno do servidor" ao entrar, a cada deploy, num sistema que por
 * todo o resto funcionava.
 *
 * O Prisma continua sendo o dono do schema, em prisma/schema.prisma. O
 * que ele não é mais é um segundo caminho de dados em produção.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validatedFields = LoginSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { email, password } = validatedFields.data

    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, password, role")
      .eq("email", email)
      .maybeSingle()

    if (error) {
      console.error("Login error:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    // Mesma resposta para e-mail que não existe e senha errada: dizer
    // qual dos dois falhou entrega ao contrário quem tem conta aqui.
    if (!user) {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401 }
      )
    }

    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401 }
      )
    }

    await createSession({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })

    return NextResponse.json(
      { message: "Login realizado com sucesso", user: { id: user.id, name: user.name, email: user.email, role: user.role } },
      { status: 200 }
    )
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
