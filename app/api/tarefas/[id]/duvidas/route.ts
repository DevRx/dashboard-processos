import { NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { abrirDuvida } from "@/lib/tarefas/servico"

/**
 * Abrir uma dúvida a partir de uma tarefa. A dúvida é uma tarefa filha,
 * com responsável e prazo — ver lib/tarefas/servico.ts, que o conector
 * do Claude também usa.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { id } = await params
    const r = await abrirDuvida(user, id, await request.json())
    return NextResponse.json(r.corpo, { status: r.status })
  } catch (error) {
    console.error("Abrir dúvida error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
