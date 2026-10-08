import "server-only"
import { supabase } from "@/lib/supabase/server"
import { getSession } from "@/lib/session"
import { decifrar } from "@/lib/seguranca/cofre"

/**
 * A IA do escritório logado (multi-tenant, "traga sua IA").
 *
 * Devolve a chave e o modelo do escritório do usuário da requisição. A
 * chave vem cifrada do banco (cofre AES-256-GCM) e é decifrada aqui, só
 * no servidor, no momento da chamada — nunca vai para o cliente.
 *
 * Vazio ({}) quando: não há sessão, o usuário não tem escritório, o
 * escritório não configurou chave, ou a migração ainda não rodou. Nesse
 * caso `responderPergunta` cai no ambiente (a chave do escritório-sede),
 * que é o comportamento de hoje.
 */
export async function iaDoEscritorio(): Promise<{
  apiKey?: string
  modelo?: string
}> {
  try {
    const session = await getSession()
    if (!session?.userId) return {}

    const { data: eu } = await supabase
      .from("users")
      .select("escritorio_id")
      .eq("id", session.userId)
      .maybeSingle()

    const escritorioId = eu?.escritorio_id as string | null | undefined
    if (!escritorioId) return {}

    const { data: esc } = await supabase
      .from("escritorios")
      .select("anthropic_key, modelo_ia, ativo")
      .eq("id", escritorioId)
      .maybeSingle()

    if (!esc || esc.ativo === false) return {}

    const apiKey = esc.anthropic_key ? decifrar(esc.anthropic_key) ?? undefined : undefined
    const modelo = (esc.modelo_ia as string | null) ?? undefined
    return { apiKey, modelo }
  } catch {
    // Config é best-effort: na dúvida, cai no ambiente.
    return {}
  }
}
