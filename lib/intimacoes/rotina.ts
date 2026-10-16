import "server-only"
import { supabase } from "@/lib/supabase/server"
import { OAB_PADRAO } from "@/lib/integracoes/oab"
import { sincronizarDjen } from "@/lib/intimacoes/sincronizar"

/**
 * A passada automática do DJEN — o mesmo trabalho, chamado de dois
 * lugares: o cron da Vercel (app/api/cron/djen) e a ferramenta
 * `sincronizar_djen` do conector do Claude, que a rotina de saúde usa
 * para refazer a passada quando o cron não rodou no dia.
 *
 * O registro na auditoria entra nos dois casos — inclusive quando o
 * DJEN não respondeu. Uma rotina que falha calada parece uma rotina
 * que não tinha nada para trazer. É esse registro que a saúde do
 * sistema lê para dizer "a rotina do DJEN passou hoje?".
 */

/** Sem responsável nem time: a triagem de quem executa é humana. */
const TIME_PADRAO = process.env.DJEN_CRON_TIME ?? null

export async function usuarioDaRotina(): Promise<string | null> {
  const email = process.env.DJEN_CRON_USER_EMAIL

  if (email) {
    const { data } = await supabase.from("users").select("id").eq("email", email).maybeSingle()
    return data?.id ?? null
  }

  // Sem e-mail configurado, o dono da caixa é quem já tem intimações
  // guardadas; na primeira execução, o administrador.
  const { data: comIntimacoes } = await supabase.from("comunicacoes_djen").select("user_id").limit(1).maybeSingle()
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

export type ResultadoRotina =
  | { ok: true; encontradas: number; novas: number; tarefasCriadas: number; de?: string; ate?: string }
  | { ok: false; motivo: string }

export async function rodarRotinaDjen(origem: "cron" | "conector", quemPediu?: string): Promise<ResultadoRotina> {
  const userId = await usuarioDaRotina()
  if (!userId) return { ok: false, motivo: "Nenhum usuário para a rotina. Configure DJEN_CRON_USER_EMAIL." }

  const resultado = await sincronizarDjen({
    userId,
    numeroOab: OAB_PADRAO.numero,
    ufOab: OAB_PADRAO.uf,
    criarTarefas: true,
    time: TIME_PADRAO,
  })

  const { error: erroAuditoria } = await supabase.from("auditorias").insert({
    user_id: userId,
    acao: "DJEN_SINCRONIZACAO_AUTOMATICA",
    entidade: "comunicacao_djen",
    detalhes: resultado.ok
      ? {
          ok: true,
          origem,
          ...(quemPediu ? { pedidoPor: quemPediu } : {}),
          encontradas: resultado.encontradas,
          novas: resultado.novas,
          tarefasCriadas: resultado.tarefasCriadas,
          de: resultado.periodo.dataInicio,
          ate: resultado.periodo.dataFim,
        }
      : { ok: false, origem, motivo: resultado.motivo },
  })
  if (erroAuditoria) console.error("Auditoria da rotina DJEN:", erroAuditoria.message)

  if (!resultado.ok) return { ok: false, motivo: resultado.motivo }
  return {
    ok: true,
    encontradas: resultado.encontradas,
    novas: resultado.novas,
    tarefasCriadas: resultado.tarefasCriadas,
    de: resultado.periodo.dataInicio,
    ate: resultado.periodo.dataFim,
  }
}
