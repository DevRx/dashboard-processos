import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { DuvidaSchema } from "@/lib/validators"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Abrir uma dúvida a partir de uma tarefa.
 *
 * O que nasce aqui é uma tarefa de verdade, filha da que a originou:
 * entra no quadro, tem responsável e prazo. Guardar a pergunta num
 * campo de texto da tarefa mãe esconderia justamente o que precisa
 * aparecer — que existe trabalho parado esperando resposta.
 *
 * Herdar o time e o processo da mãe não é comodidade: a dúvida sobre a
 * pasta da Maria é trabalho da mesma equipe e do mesmo caso, e obrigar
 * quem pergunta a repetir isso é como o formulário aprende a ser
 * ignorado.
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
    const parsed = DuvidaSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      )
    }

    const doEscritorio = await idsDoEscritorio()

    const { data: mae } = await supabase
      .from("tarefas")
      .select("id, tipo, setor, processo_id, responsavel_id, data")
      .eq("id", id)
      .in("user_id", doEscritorio)
      .maybeSingle()

    if (!mae) {
      return NextResponse.json(
        { error: "Tarefa não encontrada" },
        { status: 404 }
      )
    }

    // O fio precisa ter fim: quem tem dúvida sobre a resposta pergunta
    // de novo na tarefa principal. Sem isto, "abrir a tarefa e ver as
    // perguntas dela" viraria uma árvore que ninguém lê. O banco não
    // consegue conferir isto sozinho — o CHECK não enxerga a linha da
    // mãe —, então a regra mora aqui.
    if (mae.tipo === "DUVIDA") {
      return NextResponse.json(
        { error: "Uma dúvida não abre outra dúvida. Pergunte na tarefa principal." },
        { status: 400 }
      )
    }

    const { data: duvida, error } = await supabase
      .from("tarefas")
      .insert({
        user_id: user.id,
        titulo: parsed.data.pergunta,
        tipo: "DUVIDA",
        tarefa_pai_id: mae.id,
        // Da mãe: mesma equipe, mesmo caso.
        setor: mae.setor,
        processo_id: mae.processo_id,
        responsavel_id: parsed.data.responsavelId ?? mae.responsavel_id,
        data: parsed.data.data ?? mae.data,
        prioridade: parsed.data.prioridade ?? "MEDIA",
      })
      .select("*, responsavel:users!tarefas_responsavel_id_fkey(id, name)")
      .single()

    if (error || !duvida) {
      console.error("Abrir dúvida error:", error?.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    // O evento vai no clone, não na mãe: uma linha só, num lugar só. A
    // tela da tarefa principal alcança as perguntas pelo laço
    // `tarefa_pai_id`, sem uma segunda cópia para discordar da primeira.
    const { error: erroEvento } = await supabase.from("eventos_tarefa").insert({
      tarefa_id: duvida.id,
      tipo: "DUVIDA_ABERTA",
      autor_id: user.id,
      texto: parsed.data.pergunta,
    })

    if (erroEvento) {
      // A dúvida existe; o registro dela não. Some do histórico e some
      // silenciosamente — por isso o log, e por isso não devolvemos 500:
      // desfazer agora deixaria a pessoa sem a dúvida que ela abriu.
      console.error("Evento da dúvida não gravado:", erroEvento.message)
    }

    return NextResponse.json({ duvida: toCamelCase(duvida) }, { status: 201 })
  } catch (error) {
    console.error("Abrir dúvida error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
