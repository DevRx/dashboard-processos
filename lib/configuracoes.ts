import "server-only"
import { supabase } from "@/lib/supabase/server"

// ─────────────────────────────────────────────────────────
// Configurações do escritório: chave → valor, na tabela `configuracoes`.
//
// Nasceu por uma decisão do Zeca (14/10/2026): o aviso de perícia ao
// cliente pelo WhatsApp fica construído, mas travado — "não enviar
// mensagem por ora, só quando eu der o aval". A trava é uma linha no
// banco, e não uma variável de ambiente, para ele mesmo ligar na tela
// de Automações sem deploy e sem pedir a ninguém.
//
// Sem a migration que cria a tabela, toda chave lê o valor padrão —
// e o padrão de qualquer envio é "desligado".
// ─────────────────────────────────────────────────────────

export const CHAVES = {
  /** Enviar ao cliente, pelo WhatsApp, o aviso de perícia/audiência. */
  avisoClienteWhatsapp: "aviso_cliente_whatsapp",
} as const

export type ChaveConfiguracao = (typeof CHAVES)[keyof typeof CHAVES]

const PADRAO: Record<ChaveConfiguracao, unknown> = {
  aviso_cliente_whatsapp: false,
}

export const DESCRICAO: Record<ChaveConfiguracao, string> = {
  aviso_cliente_whatsapp:
    "Enviar ao cliente, pelo WhatsApp, o aviso de perícia/audiência lido da intimação. Desligado: a tarefa de aviso nasce com a mensagem pronta, mas ninguém envia sozinho.",
}

export type Configuracao = {
  chave: ChaveConfiguracao
  valor: unknown
  descricao: string
  atualizadaEm: string | null
  atualizadaPor: { id: string; name: string } | null
  /** A tabela ainda não existe no banco: vale o padrão. */
  padrao: boolean
}

function faltaTabela(erro?: { code?: string | null; message?: string | null } | null) {
  return erro?.code === "42P01" || erro?.code === "PGRST205" || /configuracoes/.test(erro?.message ?? "")
}

export async function lerConfiguracao(chave: ChaveConfiguracao): Promise<Configuracao> {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("chave, valor, atualizada_em, atualizada_por:users!configuracoes_atualizada_por_fkey(id, name)")
    .eq("chave", chave)
    .maybeSingle()

  if (error && !faltaTabela(error)) console.error("Configuração:", error.message)

  if (!data) {
    return { chave, valor: PADRAO[chave], descricao: DESCRICAO[chave], atualizadaEm: null, atualizadaPor: null, padrao: true }
  }
  const por = data.atualizada_por as { id: string; name: string } | { id: string; name: string }[] | null
  return {
    chave,
    valor: data.valor,
    descricao: DESCRICAO[chave],
    atualizadaEm: (data.atualizada_em as string) ?? null,
    atualizadaPor: Array.isArray(por) ? (por[0] ?? null) : por,
    padrao: false,
  }
}

export async function todasConfiguracoes(): Promise<Configuracao[]> {
  return Promise.all((Object.values(CHAVES) as ChaveConfiguracao[]).map(lerConfiguracao))
}

/** A trava do aviso ao cliente: só `true` gravado no banco libera. */
export async function avisoAoClienteLiberado(): Promise<boolean> {
  const c = await lerConfiguracao(CHAVES.avisoClienteWhatsapp)
  return c.valor === true
}

export async function gravarConfiguracao(
  chave: ChaveConfiguracao,
  valor: unknown,
  usuarioId: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await supabase.from("configuracoes").upsert(
    {
      chave,
      valor,
      descricao: DESCRICAO[chave],
      atualizada_em: new Date().toISOString(),
      atualizada_por: usuarioId,
    },
    { onConflict: "chave" }
  )
  if (error) {
    if (faltaTabela(error)) {
      return { ok: false, erro: "A tabela de configurações ainda não existe: rode a migration 20261014220000_intimacao_evento_aviso.sql no Supabase." }
    }
    console.error("Gravar configuração:", error.message)
    return { ok: false, erro: "Não foi possível gravar agora." }
  }
  return { ok: true }
}

export function isChaveConfiguracao(valor?: string | null): valor is ChaveConfiguracao {
  return (Object.values(CHAVES) as string[]).includes(valor ?? "")
}
