import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { cifrar } from "@/lib/seguranca/cofre"

/**
 * Atualiza um escritório (plano, modelo de IA, chave, ativo). Só ADMIN.
 * A chave nova chega em claro, é cifrada aqui e nunca volta na resposta;
 * string vazia limpa a chave.
 */

async function exigirAdmin() {
  const user = await getCurrentUser()
  if (!user) {
    return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  }
  if (user.role !== "ADMIN") {
    return {
      erro: NextResponse.json(
        { error: "Só administrador pode gerenciar escritórios" },
        { status: 403 }
      ),
    }
  }
  return { erro: undefined as NextResponse | undefined }
}

const AtualizarSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  plano: z.string().max(40).optional(),
  modeloIa: z.string().max(80).nullable().optional(),
  anthropicKey: z.string().max(400).optional(),
  ativo: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await exigirAdmin()
  if (g.erro) return g.erro

  const { id } = await params
  const parsed = AtualizarSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  }
  const { nome, plano, modeloIa, anthropicKey, ativo } = parsed.data

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (nome !== undefined) patch.nome = nome
  if (plano !== undefined) patch.plano = plano
  if (modeloIa !== undefined) patch.modelo_ia = modeloIa || null
  if (ativo !== undefined) patch.ativo = ativo
  if (anthropicKey !== undefined) {
    patch.anthropic_key = anthropicKey ? cifrar(anthropicKey) : null
  }

  const { data, error } = await supabase
    .from("escritorios")
    .update(patch)
    .eq("id", id)
    .select("id, nome, plano, modelo_ia, ativo, anthropic_key, created_at")
    .maybeSingle()

  if (error || !data) {
    console.error("Atualizar escritório:", error?.message)
    return NextResponse.json({ error: "Erro ao atualizar escritório" }, { status: 500 })
  }

  return NextResponse.json(
    {
      escritorio: {
        id: data.id,
        nome: data.nome,
        plano: data.plano,
        modeloIa: data.modelo_ia,
        ativo: data.ativo,
        temChave: Boolean(data.anthropic_key),
        createdAt: data.created_at,
      },
    },
    { status: 200 }
  )
}
