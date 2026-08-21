import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { calcularPrazoFinal } from "@/lib/domain/prazo"
import { prioridadePorPrazo } from "@/lib/domain/intimacao"
import { idsDoEscritorio } from "@/lib/escritorio"

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

/**
 * Quantas intimações são gravadas ao mesmo tempo.
 *
 * Cada intimação custa até duas idas ao banco, e uma não depende do
 * resultado da outra — enfileirar todas em série fazia o recálculo de
 * uma carteira grande levar minutos de espera parada. O lote existe
 * para não trocar essa fila por uma enxurrada de conexões simultâneas.
 */
const TAMANHO_DO_LOTE = 8

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
      .in("user_id", await idsDoEscritorio())
      .not("prazo_dias", "is", null)

    if (error) {
      console.error("Recalcular prazos:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    // A conta é local e barata: dá para separar antes quem realmente
    // mudou e só levar esses ao banco.
    const paraGravar = (data ?? []).flatMap((item) => {
      const novo = calcularPrazoFinal(
        String(item.data_disponibilizacao),
        item.prazo_dias as number,
        item.sigla_tribunal as string | null
      )

      const atual = item.prazo_estimado
        ? String(item.prazo_estimado).slice(0, 10)
        : null

      return atual === novo ? [] : [{ id: item.id, tarefaId: item.tarefa_id, novo }]
    })

    let atualizadas = 0
    let tarefasMovidas = 0

    async function gravar(alvo: (typeof paraGravar)[number]) {
      const { error: erroIntimacao } = await supabase
        .from("comunicacoes_djen")
        .update({ prazo_estimado: alvo.novo })
        .eq("id", alvo.id)
        .in("user_id", await idsDoEscritorio())

      if (erroIntimacao) {
        console.error("Recalcular intimação:", erroIntimacao.message)
        return
      }

      atualizadas++

      if (!alvo.tarefaId) return

      const { data: tarefa, error: erroTarefa } = await supabase
        .from("tarefas")
        .update({ data: alvo.novo, prioridade: prioridadePorPrazo(alvo.novo) })
        .eq("id", alvo.tarefaId)
        .in("user_id", await idsDoEscritorio())
        .neq("status", "CONCLUIDA")
        .select("id")
        .maybeSingle()

      if (erroTarefa) {
        console.error("Mover tarefa do prazo:", erroTarefa.message)
        return
      }

      if (tarefa) tarefasMovidas++
    }

    for (let i = 0; i < paraGravar.length; i += TAMANHO_DO_LOTE) {
      await Promise.all(paraGravar.slice(i, i + TAMANHO_DO_LOTE).map(gravar))
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
