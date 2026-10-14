import { NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { agirNoFluxo } from "@/lib/tarefas/servico"

/**
 * Ações do fluxo sobre uma tarefa: mover de etapa (inclusive voltar),
 * pôr também em outro lugar, concluir a parte de alguém, concluir a
 * etapa para todos, trocar os responsáveis. A regra mora em
 * lib/tarefas/servico.ts — a mesma que o conector do Claude usa.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await params
  const r = await agirNoFluxo(user, id, await request.json().catch(() => null))
  return NextResponse.json(r.corpo, { status: r.status })
}
