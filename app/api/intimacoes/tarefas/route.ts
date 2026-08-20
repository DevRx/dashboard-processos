import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { gerarTarefasDasIntimacoes } from "@/lib/intimacoes/gerar-tarefas"
import { TimeTarefaEnum } from "@/lib/validators"

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
        "id, processo_id, tarefa_id, prazo_estimado, prazo_dias, tipo_documento, tipo_comunicacao, destinatario, numero_processo_mascara, sigla_tribunal, nome_orgao, link, texto"
      )
      .eq("user_id", user.id)
      .is("tarefa_id", null)
      .is("tratada_em", null)
      .not("prazo_estimado", "is", null)

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
