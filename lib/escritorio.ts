import "server-only"
import { cache } from "react"
import { supabase } from "@/lib/supabase/server"
import { getSession } from "@/lib/session"

/**
 * O dono do dado é o escritório, não quem digitou.
 *
 * Cada linha guarda em `user_id` quem a cadastrou (autoria). A leitura
 * é por escritório: todas as consultas filtram por `idsDoEscritorio()`,
 * então escopar aqui escopa o sistema inteiro de uma vez.
 *
 * Multi-tenant: o escritório do usuário logado sai de `users.escritorio_id`
 * (migração 20261008_multi_tenant). A função devolve os ids dos usuários
 * do MESMO escritório.
 *
 * Retrocompatível de propósito, para não quebrar nada antes da migração
 * nem a rotina de fundo:
 *  - sem sessão e sem usuário informado (ex.: cron DJEN) → escopo de
 *    hoje, todos os usuários. Numa instalação de um escritório só isso
 *    é correto; no multi-tenant real o cron roda por escritório e passa
 *    `usuarioId` (pendência conhecida).
 *  - usuário sem `escritorio_id` (coluna ainda não existe / não migrado)
 *    → também cai no escopo de hoje.
 *
 * `cache` da React deduplica dentro da mesma requisição.
 */
export const idsDoEscritorio = cache(
  async (usuarioId?: string): Promise<string[]> => {
    const baseId = usuarioId ?? (await getSession())?.userId

    if (baseId) {
      const { data: eu, error } = await supabase
        .from("users")
        .select("escritorio_id")
        .eq("id", baseId)
        .maybeSingle()

      const escritorioId =
        !error && eu ? (eu.escritorio_id as string | null | undefined) : undefined

      if (escritorioId) {
        const { data } = await supabase
          .from("users")
          .select("id")
          .eq("escritorio_id", escritorioId)
        return (data ?? []).map((u) => u.id as string)
      }
    }

    // Escopo de hoje: instalação de um escritório só, ou rotina de fundo.
    const { data, error } = await supabase.from("users").select("id")
    if (error) {
      // Lista vazia é o lado seguro: não achar nada, em vez de deixar de
      // filtrar e achar tudo.
      console.error("Escopo do escritório:", error.message)
      return []
    }
    return (data ?? []).map((u) => u.id as string)
  }
)
