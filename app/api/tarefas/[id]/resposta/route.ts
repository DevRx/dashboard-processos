import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { RespostaDuvidaSchema } from "@/lib/validators"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Responder uma dúvida — e, com isso, fechá-la.
 *
 * A resposta mora na própria dúvida, junto da pergunta: é quem reabre
 * o caso meses depois que precisa das duas lado a lado. O evento no
 * histórico é o registro de quando e por quem; a resposta em si é o
 * conteúdo da tarefa.
 *
 * Concluir junto é de propósito. Uma dúvida respondida que continua no
 * quadro é ruído — e pedir dois cliques para o mesmo ato é como as
 * pessoas aprendem a deixar a segunda metade por fazer.
 */
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
    const parsed = RespostaDuvidaSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      )
    }

    const doEscritorio = await idsDoEscritorio()

    const { data: duvida } = await supabase
      .from("tarefas")
      .select("id, tipo, status, resposta")
      .eq("id", id)
      .in("user_id", doEscritorio)
      .maybeSingle()

    if (!duvida) {
      return NextResponse.json(
        { error: "Tarefa não encontrada" },
        { status: 404 }
      )
    }

    if (duvida.tipo !== "DUVIDA") {
      return NextResponse.json(
        { error: "Esta tarefa não é uma dúvida" },
        { status: 400 }
      )
    }

    // Responder de novo não sobrescreve: a primeira resposta é o que
    // orientou o trabalho que veio depois, e apagá-la reescreveria a
    // história. Quem quer corrigir abre outra dúvida na tarefa mãe.
    if (duvida.resposta) {
      return NextResponse.json(
        { error: "Esta dúvida já foi respondida" },
        { status: 409 }
      )
    }

    const statusAntes = duvida.status

    const { data: atualizada, error } = await supabase
      .from("tarefas")
      .update({
        resposta: parsed.data.resposta,
        respondida_em: new Date().toISOString(),
        respondida_por: user.id,
        status: "CONCLUIDA",
      })
      .eq("id", id)
      .in("user_id", doEscritorio)
      .select("*, responsavel:users!tarefas_responsavel_id_fkey(id, name)")
      .single()

    if (error || !atualizada) {
      console.error("Responder dúvida error:", error?.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    const { error: erroEvento } = await supabase.from("eventos_tarefa").insert([
      {
        tarefa_id: id,
        tipo: "DUVIDA_RESPONDIDA",
        autor_id: user.id,
        texto: parsed.data.resposta,
      },
      {
        tarefa_id: id,
        tipo: "STATUS_ALTERADO",
        autor_id: user.id,
        status_de: statusAntes,
        status_para: "CONCLUIDA",
      },
    ])

    if (erroEvento) {
      console.error("Evento da resposta não gravado:", erroEvento.message)
    }

    return NextResponse.json({ duvida: toCamelCase(atualizada) }, { status: 200 })
  } catch (error) {
    console.error("Responder dúvida error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
