import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth"
import { tarefasDoBackup } from "@/lib/importacao/ticktick"

/**
 * Importar o backup do TickTick.
 *
 * Só ADMIN: são milhares de tarefas de uma vez, e desfazer uma
 * importação errada é trabalho de banco, não de tela.
 *
 * O arquivo vem do navegador e não fica guardado em lugar nenhum — ele
 * carrega CPF e senha de cliente, e o lugar desses dados é a tarefa,
 * não uma cópia solta do backup.
 *
 * Reimportar é seguro: cada tarefa carrega o `origem_id` da linha de
 * onde veio, e a que já existe é pulada — inclusive se alguém já a
 * moveu de time ou concluiu aqui.
 */

// Lotes de 500: grandes o bastante para 5 mil tarefas caberem em
// poucos segundos, pequenos o bastante para um lote nunca bater no
// limite de corpo do PostgREST.
const LOTE = 500

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Só um administrador importa tarefas" },
        { status: 403 }
      )
    }

    const form = await request.formData()
    const arquivo = form.get("arquivo")
    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        { error: "Envie o arquivo .csv do backup do TickTick" },
        { status: 400 }
      )
    }

    let tarefas
    try {
      tarefas = tarefasDoBackup(await arquivo.text())
    } catch (erro) {
      return NextResponse.json(
        { error: erro instanceof Error ? erro.message : "Arquivo ilegível" },
        { status: 400 }
      )
    }

    let novas = 0
    for (let i = 0; i < tarefas.length; i += LOTE) {
      const lote = tarefas.slice(i, i + LOTE).map((t) => ({ ...t, user_id: user.id }))

      const { data, error } = await supabase
        .from("tarefas")
        .upsert(lote, { onConflict: "origem_id", ignoreDuplicates: true })
        .select("id")

      if (error) {
        console.error("Importar TickTick:", error.message)
        return NextResponse.json(
          {
            error:
              novas > 0
                ? `Parou no meio: ${novas} tarefas entraram. Rode de novo — as que já entraram são puladas.`
                : "Não foi possível gravar as tarefas. Veja /api/saude — pode faltar a migration 20260925120000_tarefas_pasta_e_origem.",
          },
          { status: 500 }
        )
      }
      novas += data?.length ?? 0
    }

    const contar = (status: string) => tarefas.filter((t) => t.status === status).length

    return NextResponse.json(
      {
        lidas: tarefas.length,
        novas,
        jaExistiam: tarefas.length - novas,
        abertas: contar("PENDENTE"),
        concluidas: contar("CONCLUIDA"),
        canceladas: contar("CANCELADA"),
        semTime: tarefas.filter((t) => !t.setor).length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Importar TickTick:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
