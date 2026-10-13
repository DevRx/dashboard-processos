import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { MoverTarefasSchema } from "@/lib/validators"
import { getCurrentUser } from "@/lib/auth"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Leva várias tarefas para o lugar do fluxo novo de uma vez.
 *
 * Quem usa é a faixa "fora do lugar" das telas dos times: tarefas que o
 * TickTick deixou num time e que, pelo desenho de 13/10/2026, são de
 * outro (o protocolo novo do JUDICIAL, que é do amarelo; o aguardando
 * assinatura, que é do azul). A tela mostra a lista antes; só o
 * administrador move em lote.
 *
 * Os movimentos chegam um por tarefa e são gravados em grupo — um
 * UPDATE por destino, não um por tarefa.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Só o administrador move tarefas em lote" },
        { status: 403 }
      )
    }

    const parsed = MoverTarefasSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      )
    }

    const porDestino = new Map<string, { setor: string; pasta: string; ids: string[] }>()
    for (const m of parsed.data.movimentos) {
      const chave = `${m.setor}\u0000${m.pasta}`
      const grupo = porDestino.get(chave) ?? { setor: m.setor, pasta: m.pasta, ids: [] }
      grupo.ids.push(m.id)
      porDestino.set(chave, grupo)
    }

    const escritorio = await idsDoEscritorio()
    let movidas = 0
    const falhas: string[] = []

    for (const grupo of porDestino.values()) {
      const { data, error } = await supabase
        .from("tarefas")
        .update({ setor: grupo.setor, pasta: grupo.pasta })
        .in("id", grupo.ids)
        .in("user_id", escritorio)
        .select("id")

      if (error) {
        console.error("Mover tarefas:", error.message)
        falhas.push(`${grupo.setor} › ${grupo.pasta}`)
        continue
      }
      movidas += data?.length ?? 0
    }

    if (falhas.length && movidas === 0) {
      return NextResponse.json(
        { error: `Não foi possível mover para: ${falhas.join(", ")}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ movidas, falhas }, { status: 200 })
  } catch (error) {
    console.error("Mover tarefas error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
