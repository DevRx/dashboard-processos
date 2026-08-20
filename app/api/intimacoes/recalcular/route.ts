import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { calcularPrazoFinal } from "@/lib/domain/prazo"
import { prioridadePorPrazo } from "@/lib/domain/intimacao"

/**
 * Recalcula as datas-limite com o calendário forense atual.
 *
 * Existe para o dia em que o escritório cadastrar os feriados e as
 * suspensões de cada tribunal: sem isso, as intimações antigas
 * ficariam com a data da conta antiga e as duas versões conviveriam na
 * mesma tela.
 *
 * A tarefa vinculada anda junto — inclusive a prioridade, porque um
 * prazo que se afastou deixa de ser urgente. Tarefa concluída não é
 * tocada: mexer na data de algo já feito só reescreve o passado.
 */
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("comunicacoes_djen")
      .select(
        "id, data_disponibilizacao, prazo_dias, prazo_estimado, sigla_tribunal, tarefa_id"
      )
      .eq("user_id", user.id)
      .not("prazo_dias", "is", null)

    if (error) {
      console.error("Recalcular prazos:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    let atualizadas = 0
    let tarefasMovidas = 0

    for (const item of data ?? []) {
      const novo = calcularPrazoFinal(
        String(item.data_disponibilizacao),
        item.prazo_dias as number,
        item.sigla_tribunal as string | null
      )

      const atual = item.prazo_estimado
        ? String(item.prazo_estimado).slice(0, 10)
        : null

      if (atual === novo) continue

      const { error: erroIntimacao } = await supabase
        .from("comunicacoes_djen")
        .update({ prazo_estimado: novo })
        .eq("id", item.id)
        .eq("user_id", user.id)

      if (erroIntimacao) {
        console.error("Recalcular intimação:", erroIntimacao.message)
        continue
      }

      atualizadas++

      if (!item.tarefa_id) continue

      const { data: tarefa, error: erroTarefa } = await supabase
        .from("tarefas")
        .update({ data: novo, prioridade: prioridadePorPrazo(novo) })
        .eq("id", item.tarefa_id)
        .eq("user_id", user.id)
        .neq("status", "CONCLUIDA")
        .select("id")
        .maybeSingle()

      if (erroTarefa) {
        console.error("Mover tarefa do prazo:", erroTarefa.message)
        continue
      }

      if (tarefa) tarefasMovidas++
    }

    return NextResponse.json({ atualizadas, tarefasMovidas }, { status: 200 })
  } catch (error) {
    console.error("Recalcular prazos:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
