import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { supabase } from "@/lib/supabase/server"
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
 *
 * Fala com o Supabase como todo o resto — ver o comentário em
 * ../login/route.ts sobre por que o Prisma saiu daqui.
 */
export async function POST(request: NextRequest) {
  try {
    // `head: true` traz só a contagem, sem as linhas: aqui a pergunta é
    // "existe alguém?", e trazer a carteira inteira para responder isso
    // seria caro à toa.
    const { count, error: erroContagem } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })

    if (erroContagem) {
      console.error("Register error:", erroContagem.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    // Contagem desconhecida trata como "há gente": o lado seguro do
    // erro é exigir ADMIN, não abrir o cadastro para a rua.
    if ((count ?? 1) > 0) {
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

    const { data: existente } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (existente) {
      return NextResponse.json(
        { error: "E-mail já cadastrado" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        name,
        email,
        password: hashedPassword,
        role: role || "USER",
      })
      .select("id, name, email, role")
      .single()

    if (error || !user) {
      // O índice único do e-mail é quem decide de verdade: entre a
      // conferência acima e este insert cabe outro cadastro igual.
      const duplicado = error?.code === "23505"
      console.error("Register error:", error?.message)
      return NextResponse.json(
        { error: duplicado ? "E-mail já cadastrado" : "Erro interno do servidor" },
        { status: duplicado ? 400 : 500 }
      )
    }

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
