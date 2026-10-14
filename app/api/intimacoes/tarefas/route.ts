import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { gerarTarefasDasIntimacoes } from "@/lib/intimacoes/gerar-tarefas"
import { TimeTarefaEnum } from "@/lib/validators"
import { idsDoEscritorio } from "@/lib/escritorio"

const MutiraoSchema = z.object({ time: TimeTarefaEnum.nullish() })

/**
 * Mutirão: cria de uma vez as tarefas dos prazos que ainda não têm.
 *
 * Existe para o que já estava guardado antes da criação automática
 * entrar, e para quando alguém desliga a automação por um dia e depois
 * se arrepende. Intimação tratada fica de fora — se já foi resolvida,
 * abrir tarefa agora é ruído.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const parsed = MutiraoSchema.safeParse(await request.json().catch(() => ({})))
    const time = parsed.success ? parsed.data.time : null

    const { data, error } = await supabase
      .from("comunicacoes_djen")
      .select(
        "id, processo_id, tarefa_id, prazo_estimado, prazo_dias, tipo_documento, tipo_comunicacao, destinatario, numero_processo_mascara, sigla_tribunal, nome_orgao, link, texto, ia_tipo_ato, ia_providencia, ia_urgencia, ia_prazo_de_quem, aviso_tarefa_id, ia_evento_tipo, ia_evento_data, ia_evento_hora, ia_evento_local, ia_mensagem_cliente"
      )
      .in("user_id", await idsDoEscritorio())
      .is("tratada_em", null)
      // Falta a tarefa do prazo/evento, ou falta o aviso do evento.
      .or("and(tarefa_id.is.null,or(prazo_estimado.not.is.null,ia_evento_data.not.is.null)),and(aviso_tarefa_id.is.null,ia_evento_data.not.is.null)")

    if (error) {
      console.error("Mutirão de tarefas:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    const resultado = await gerarTarefasDasIntimacoes(user.id, data ?? [], time)

    return NextResponse.json(resultado, { status: 200 })
  } catch (error) {
    console.error("Mutirão de tarefas:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
