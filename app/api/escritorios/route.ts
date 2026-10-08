import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { cifrar } from "@/lib/seguranca/cofre"

/**
 * Provisionamento de escritórios (multi-tenant). Só ADMIN.
 *
 * "Você provisiona": aqui o admin cria o escritório, define o plano e o
 * modelo de IA, e cola a chave da Anthropic do escritório — que é
 * guardada CIFRADA (cofre AES). A chave NUNCA volta na resposta: a UI
 * só sabe se existe (`temChave`).
 */

type Guard =
  | { erro: NextResponse; user?: undefined }
  | { erro?: undefined; user: Awaited<ReturnType<typeof getCurrentUser>> }

async function exigirAdmin(): Promise<Guard> {
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
  return { user }
}

type LinhaEscritorio = {
  id: string
  nome: string
  plano: string
  modelo_ia: string | null
  ativo: boolean
  anthropic_key: string | null
  created_at: string
}

function paraFora(e: LinhaEscritorio) {
  return {
    id: e.id,
    nome: e.nome,
    plano: e.plano,
    modeloIa: e.modelo_ia,
    ativo: e.ativo,
    temChave: Boolean(e.anthropic_key),
    createdAt: e.created_at,
  }
}

const SELECT = "id, nome, plano, modelo_ia, ativo, anthropic_key, created_at"

export async function GET() {
  const g = await exigirAdmin()
  if (g.erro) return g.erro

  const { data, error } = await supabase
    .from("escritorios")
    .select(SELECT)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Listar escritórios:", error.message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }

  return NextResponse.json(
    { escritorios: (data ?? []).map((e) => paraFora(e as LinhaEscritorio)) },
    { status: 200 }
  )
}

const CriarSchema = z.object({
  nome: z.string().min(1).max(120),
  plano: z.string().max(40).optional(),
  modeloIa: z.string().max(80).optional(),
  anthropicKey: z.string().max(400).optional(),
})

export async function POST(request: NextRequest) {
  const g = await exigirAdmin()
  if (g.erro) return g.erro

  const parsed = CriarSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  }
  const { nome, plano, modeloIa, anthropicKey } = parsed.data

  const { data, error } = await supabase
    .from("escritorios")
    .insert({
      nome,
      plano: plano || "ESSENCIAL",
      modelo_ia: modeloIa || null,
      anthropic_key: anthropicKey ? cifrar(anthropicKey) : null,
    })
    .select(SELECT)
    .maybeSingle()

  if (error || !data) {
    console.error("Criar escritório:", error?.message)
    return NextResponse.json({ error: "Erro ao criar escritório" }, { status: 500 })
  }

  return NextResponse.json(
    { escritorio: paraFora(data as LinhaEscritorio) },
    { status: 201 }
  )
}
