import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { OAB_PADRAO } from "@/lib/integracoes/oab"
import { sincronizarDjen } from "@/lib/intimacoes/sincronizar"

/**
 * Rotina automática: busca o DJEN e abre as tarefas dos prazos, sem
 * ninguém clicar.
 *
 * Acionada por agendador externo (Vercel Cron em produção, launchd ou
 * cron na máquina do escritório) com o header `x-cron-secret` — o
 * mesmo padrão do expurgo da LGPD. Sem `DJEN_CRON_SECRET` configurada
 * a rota fica indisponível em vez de liberar acesso: falha fechada.
 *
 * Rodar mais de uma vez no dia não faz mal — a trava é o `djen_id`
 * único por usuário, e tarefa só nasce de intimação que ainda não tem
 * uma. Isso também é o que permite agendar com folga: se a máquina
 * estava desligada às 8h, a passada das 13h faz o mesmo serviço.
 */

/** Sem responsável nem time: a triagem de quem executa é humana. */
const TIME_PADRAO = process.env.DJEN_CRON_TIME ?? null

async function usuarioDaRotina(): Promise<string | null> {
  const email = process.env.DJEN_CRON_USER_EMAIL

  if (email) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    return data?.id ?? null
  }

  // Sem e-mail configurado, o dono da caixa é quem já tem intimações
  // guardadas; na primeira execução, o administrador.
  const { data: comIntimacoes } = await supabase
    .from("comunicacoes_djen")
    .select("user_id")
    .limit(1)
    .maybeSingle()

  if (comIntimacoes?.user_id) return comIntimacoes.user_id as string

  const { data: admin } = await supabase
    .from("users")
    .select("id")
    .eq("role", "ADMIN")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return admin?.id ?? null
}

async function executar(request: NextRequest) {
  const segredoConfigurado = process.env.DJEN_CRON_SECRET
  const segredoRecebido = request.headers.get("x-cron-secret")

  if (!segredoConfigurado || segredoRecebido !== segredoConfigurado) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const userId = await usuarioDaRotina()

  if (!userId) {
    return NextResponse.json(
      { error: "Nenhum usuário para a rotina. Configure DJEN_CRON_USER_EMAIL." },
      { status: 500 }
    )
  }

  const resultado = await sincronizarDjen({
    userId,
    numeroOab: OAB_PADRAO.numero,
    ufOab: OAB_PADRAO.uf,
    criarTarefas: true,
    time: TIME_PADRAO,
  })

  // O registro entra nos dois casos — inclusive quando o DJEN não
  // respondeu. Uma rotina que falha calada parece uma rotina que não
  // tinha nada para trazer.
  const { error: erroAuditoria } = await supabase.from("auditorias").insert({
    user_id: userId,
    acao: "DJEN_SINCRONIZACAO_AUTOMATICA",
    entidade: "comunicacao_djen",
    detalhes: resultado.ok
      ? {
          ok: true,
          encontradas: resultado.encontradas,
          novas: resultado.novas,
          tarefasCriadas: resultado.tarefasCriadas,
          de: resultado.periodo.dataInicio,
          ate: resultado.periodo.dataFim,
        }
      : { ok: false, motivo: resultado.motivo },
  })

  if (erroAuditoria) {
    console.error("Auditoria da rotina DJEN:", erroAuditoria.message)
  }

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.motivo }, { status: 502 })
  }

  console.log(
    `[cron djen] ${resultado.novas} nova(s), ${resultado.tarefasCriadas} tarefa(s)`
  )

  return NextResponse.json(resultado, { status: 200 })
}

/** GET porque é o método que os agendadores mandam por padrão. */
export async function GET(request: NextRequest) {
  return executar(request)
}

export async function POST(request: NextRequest) {
  return executar(request)
}
