import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { ProcessoStatusEnum } from "@/lib/validators"
import { getProcessoStatusLabel } from "@/lib/domain/processo"

/**
 * Troca de status pelo quadro, sem passar pelo formulário inteiro.
 *
 * Toda troca vira andamento: no judicial, "quando mudou de fase" é a
 * pergunta que o cliente faz ao telefone, e a resposta precisa estar
 * no histórico, não só no campo.
 */
const StatusSchema = z.object({ status: ProcessoStatusEnum })

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
    const parsed = StatusSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 })
    }

    const { data: processo, error } = await supabase
      .from("processos")
      .update({ status: parsed.data.status })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, status")
      .maybeSingle()

    if (error || !processo) {
      console.error("Atualizar status error:", error?.message)
      return NextResponse.json(
        { error: "Processo não encontrado" },
        { status: 404 }
      )
    }

    const { error: erroAndamento } = await supabase.from("andamentos").insert({
      processo_id: id,
      user_id: user.id,
      data: new Date().toISOString().slice(0, 10),
      descricao: `Fase alterada para ${getProcessoStatusLabel(parsed.data.status)}`,
      status: parsed.data.status,
    })

    // O histórico é registro, não pré-condição: falhar em anotar não
    // desfaz a troca de fase que o usuário acabou de ver acontecer.
    if (erroAndamento) {
      console.error("Andamento da troca de fase:", erroAndamento.message)
    }

    return NextResponse.json({ status: processo.status }, { status: 200 })
  } catch (error) {
    console.error("Atualizar status error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
