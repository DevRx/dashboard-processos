import { NextResponse } from "next/server"

import { supabase } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth"
import { idsDoEscritorio } from "@/lib/escritorio"
import { linhasPelaPasta, type TarefaComLugar } from "@/lib/domain/tarefa"
import {
  MENSAGEM_SEM_MIGRATION,
  faltaMigration,
  fluxoDisponivel,
  materializarLote,
  tarefasDeIntimacao,
  tarefasJaNoFluxo,
} from "@/lib/fluxo/servidor"

/**
 * A entrada das tarefas do TickTick no fluxo novo, de uma vez.
 *
 * Enquanto uma tarefa não tem linha no fluxo, a tela a mostra onde a
 * pasta do TickTick indica — e o resto do sistema (agenda, dashboard)
 * ainda a vê no time antigo. Gravar as linhas acerta tudo de uma vez:
 * daí em diante quem manda é o fluxo, e o TickTick fica de fora.
 *
 * GET diz quantas faltam; POST (só administrador) grava. Repetir não
 * duplica nada — tarefa que já tem linha é pulada no banco.
 */

async function pendentes() {
  const escritorio = await idsDoEscritorio()
  const PAGINA = 1000
  const abertas: TarefaComLugar[] = []

  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from("tarefas")
      .select("id, setor, pasta, titulo, tipo, status, responsavel_id")
      .in("user_id", escritorio)
      .not("status", "in", "(CONCLUIDA,CANCELADA)")
      .order("id", { ascending: true })
      .range(de, de + PAGINA - 1)
    if (error) throw error
    for (const t of data ?? []) {
      abertas.push({
        id: t.id,
        setor: t.setor,
        pasta: t.pasta,
        titulo: t.titulo,
        tipo: t.tipo,
        status: t.status,
        responsavelId: t.responsavel_id,
      })
    }
    if (!data || data.length < PAGINA) break
  }

  const jaNoFluxo = await tarefasJaNoFluxo()
  const deIntimacao = await tarefasDeIntimacao(escritorio)

  return abertas
    .filter((t) => !jaNoFluxo.has(t.id))
    .map((t) => ({ tarefaId: t.id, linhas: linhasPelaPasta({ ...t, deIntimacao: deIntimacao.has(t.id) }) }))
    .filter((it) => it.linhas.length > 0)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  try {
    if (!(await fluxoDisponivel())) {
      return NextResponse.json({ disponivel: false, semFluxo: null, aviso: MENSAGEM_SEM_MIGRATION })
    }
    return NextResponse.json({ disponivel: true, semFluxo: (await pendentes()).length })
  } catch (erro) {
    if (faltaMigration(erro as { code?: string })) {
      return NextResponse.json({ disponivel: false, semFluxo: null, aviso: MENSAGEM_SEM_MIGRATION })
    }
    console.error("Fluxo — pendentes:", (erro as Error)?.message ?? erro)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Só o administrador traz as tarefas para o fluxo novo" }, { status: 403 })
  }

  try {
    if (!(await fluxoDisponivel())) return NextResponse.json({ error: MENSAGEM_SEM_MIGRATION }, { status: 503 })
    const itens = await pendentes()
    const gravadas = await materializarLote(itens, user.id)
    return NextResponse.json({ tarefas: itens.length, linhas: gravadas })
  } catch (erro) {
    if (faltaMigration(erro as { code?: string })) {
      return NextResponse.json({ error: MENSAGEM_SEM_MIGRATION }, { status: 503 })
    }
    console.error("Fluxo — trazer tarefas:", (erro as Error)?.message ?? erro)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
