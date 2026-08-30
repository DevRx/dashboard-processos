import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * O histórico de uma tarefa.
 *
 * Numa tarefa comum ele traz os eventos dela **e os das dúvidas que
 * saíram dela**. É isso que faz a dúvida ficar "integrada à tarefa
 * principal": quem abre a pasta grande vê as perguntas que a
 * seguraram, sem precisar caçar os clones no quadro.
 *
 * Numa dúvida, traz só os próprios eventos — a pergunta, a resposta e
 * a mudança de status. O caminho de volta para a mãe é o campo
 * `tarefaPai` na resposta, não uma cópia dos eventos dela.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const doEscritorio = await idsDoEscritorio()

    const { data: tarefa } = await supabase
      .from("tarefas")
      .select("id, titulo, tipo, tarefa_pai_id")
      .eq("id", id)
      .in("user_id", doEscritorio)
      .maybeSingle()

    if (!tarefa) {
      return NextResponse.json(
        { error: "Tarefa não encontrada" },
        { status: 404 }
      )
    }

    // As dúvidas filhas, para o histórico da mãe alcançar os eventos
    // delas — e para a tela listar as perguntas em aberto.
    const { data: filhas } = await supabase
      .from("tarefas")
      .select("id, titulo, status, resposta, respondida_em, created_at, responsavel:users!tarefas_responsavel_id_fkey(id, name)")
      .eq("tarefa_pai_id", id)
      .in("user_id", doEscritorio)
      .order("created_at", { ascending: false })

    const duvidas = filhas ?? []
    const titulos = new Map(duvidas.map((d) => [d.id, d.titulo]))
    const alvos = [id, ...duvidas.map((d) => d.id)]

    const { data: eventos, error } = await supabase
      .from("eventos_tarefa")
      .select("*, autor:users(id, name)")
      .in("tarefa_id", alvos)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Histórico error:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    // A tarefa mãe, quando esta aqui é uma dúvida: é o "de onde vim"
    // que a tela mostra no topo.
    let tarefaPai = null
    if (tarefa.tarefa_pai_id) {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo")
        .eq("id", tarefa.tarefa_pai_id)
        .in("user_id", doEscritorio)
        .maybeSingle()
      tarefaPai = data
    }

    return NextResponse.json(
      {
        eventos: (eventos ?? []).map((e) => ({
          id: e.id,
          tarefaId: e.tarefa_id,
          tipo: e.tipo,
          texto: e.texto,
          statusDe: e.status_de,
          statusPara: e.status_para,
          criadoEm: e.created_at,
          autor: e.autor ?? null,
          // Marca o evento que veio de uma filha, para a tela dizer
          // "nesta dúvida" em vez de fingir que aconteceu na mãe.
          daDuvida:
            e.tarefa_id === id
              ? null
              : { id: e.tarefa_id, titulo: titulos.get(e.tarefa_id) ?? "" },
        })),
        duvidas: duvidas.map((d) => ({
          id: d.id,
          titulo: d.titulo,
          status: d.status,
          resposta: d.resposta,
          respondidaEm: d.respondida_em,
          criadoEm: d.created_at,
          responsavel: d.responsavel ?? null,
        })),
        tarefaPai,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Histórico error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
