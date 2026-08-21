import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { cifrar, decifrar } from "@/lib/seguranca/cofre"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Campos da ficha administrativa que a equipe edita direto na fila,
 * sem abrir o cadastro do cliente.
 *
 * Vive fora do PUT de /api/clientes/[id] de propósito: aquele endpoint
 * valida o cadastro inteiro e um PUT com o corpo pela metade apagaria
 * telefone, endereço e data de nascimento.
 */
const FichaSchema = z.object({
  observacoes: z.string().max(5000, "Comentário longo demais").optional(),
  /** String vazia remove a senha guardada. */
  senhaMeuInss: z.string().max(200, "Senha longa demais").optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const parsed = FichaSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      )
    }

    const campos: Record<string, string | null> = {}

    if (parsed.data.observacoes !== undefined) {
      campos.observacoes = parsed.data.observacoes.trim() || null
    }

    if (parsed.data.senhaMeuInss !== undefined) {
      const senha = parsed.data.senhaMeuInss.trim()
      campos.senha_meu_inss = senha ? cifrar(senha) : null
    }

    if (Object.keys(campos).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 })
    }

    const { data: cliente, error } = await supabase
      .from("clientes")
      .update(campos)
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .select("id, observacoes, senha_meu_inss")
      .maybeSingle()

    if (error || !cliente) {
      console.error("Update ficha error:", error?.message)
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        observacoes: cliente.observacoes,
        // Devolvida em claro para a tela seguir mostrando o valor sem
        // recarregar a fila inteira.
        senhaMeuInss: cliente.senha_meu_inss
          ? decifrar(cliente.senha_meu_inss)
          : null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update ficha error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
