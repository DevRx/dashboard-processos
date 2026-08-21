import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { TimeTarefaEnum } from "@/lib/validators"
import {
  descricaoDaTarefa,
  prioridadePorPrazo,
  tituloDaTarefa,
} from "@/lib/domain/intimacao"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Transforma o prazo da intimação em tarefa do quadro.
 *
 * A data vem editável de propósito: a estimativa da tela conta dias
 * úteis sem conhecer feriado nem suspensão de expediente, e quem
 * confere o processo sabe a data certa. O texto do diário fica na
 * descrição, para a tarefa não obrigar a voltar aqui.
 */
const TarefaDaIntimacaoSchema = z.object({
  data: z.string().min(1, "Informe a data do prazo"),
  titulo: z.string().min(1).max(200).optional(),
  responsavelId: z.string().nullish(),
  setor: TimeTarefaEnum.nullish(),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const parsed = TarefaDaIntimacaoSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      )
    }

    const { data: intimacao, error: erroBusca } = await supabase
      .from("comunicacoes_djen")
      .select(
        "id, tarefa_id, processo_id, destinatario, tipo_documento, tipo_comunicacao, nome_orgao, sigla_tribunal, numero_processo_mascara, texto, prazo_dias, link, ia_tipo_ato, ia_providencia, ia_urgencia, ia_prazo_de_quem"
      )
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .maybeSingle()

    if (erroBusca || !intimacao) {
      return NextResponse.json(
        { error: "Intimação não encontrada" },
        { status: 404 }
      )
    }

    if (intimacao.tarefa_id) {
      return NextResponse.json(
        { error: "Esta intimação já virou tarefa" },
        { status: 409 }
      )
    }

    // Mesmo título e mesma descrição da criação automática: o quadro
    // não deve ter dois formatos conforme quem criou a tarefa.
    const titulo = parsed.data.titulo ?? tituloDaTarefa(intimacao)
    const descricao = descricaoDaTarefa(intimacao)

    const { data: tarefa, error: erroTarefa } = await supabase
      .from("tarefas")
      .insert({
        user_id: user.id,
        processo_id: intimacao.processo_id,
        titulo,
        descricao,
        data: parsed.data.data,
        status: "PENDENTE",
        prioridade:
          parsed.data.prioridade ??
          prioridadePorPrazo(parsed.data.data, undefined, intimacao),
        setor: parsed.data.setor ?? null,
        responsavel_id: parsed.data.responsavelId ?? null,
      })
      .select("*, responsavel:users!tarefas_responsavel_id_fkey(id, name)")
      .single()

    if (erroTarefa || !tarefa) {
      console.error("Criar tarefa da intimação:", erroTarefa?.message)
      return NextResponse.json(
        { error: "Erro ao criar a tarefa" },
        { status: 500 }
      )
    }

    const { error: erroVinculo } = await supabase
      .from("comunicacoes_djen")
      .update({ tarefa_id: tarefa.id })
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())

    if (erroVinculo) {
      console.error("Vincular tarefa à intimação:", erroVinculo.message)
    }

    return NextResponse.json({ tarefa }, { status: 201 })
  } catch (error) {
    console.error("Criar tarefa da intimação error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
