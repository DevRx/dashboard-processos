import "server-only"
import { createHash, randomBytes } from "node:crypto"

import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import type { CurrentUser } from "@/lib/auth"

/**
 * Chaves de acesso do conector do Claude (migration 20261014110000).
 *
 * A chave é aleatória (32 bytes) e só o SHA-256 dela fica no banco.
 * SHA-256 e não bcrypt: a chave já é longa e aleatória — não há senha
 * fraca para proteger de força bruta —, e a conferência roda a cada
 * chamada do conector, então precisa ser barata.
 */

const PREFIXO = "dp_"

export function resumoDaChave(chave: string) {
  return createHash("sha256").update(chave, "utf8").digest("hex")
}

export function novaChave() {
  const chave = PREFIXO + randomBytes(32).toString("base64url")
  return { chave, hash: resumoDaChave(chave), prefixo: chave.slice(0, PREFIXO.length + 6) }
}

/** A chave do cabeçalho "Authorization: Bearer …", se houver. */
export function chaveDoPedido(request: Request): string | null {
  const cabecalho = request.headers.get("authorization") ?? ""
  const achado = /^Bearer\s+(\S+)\s*$/i.exec(cabecalho)
  return achado ? achado[1] : null
}

/**
 * A conta dona da chave — ou `null` se a chave não existe, foi revogada
 * ou a tabela ainda não foi criada. Marca o último uso.
 */
export async function usuarioDaChave(chave: string | null): Promise<CurrentUser | null> {
  if (!chave || !chave.startsWith(PREFIXO) || chave.length < 20) return null

  const { data, error } = await supabase
    .from("chaves_api")
    .select("id, revogada_em, usuario:users!chaves_api_usuario_id_fkey(id, name, email, role)")
    .eq("hash", resumoDaChave(chave))
    .maybeSingle()

  if (error) {
    console.error("Chave do conector:", error.message)
    return null
  }
  if (!data || data.revogada_em) return null

  const usuario = Array.isArray(data.usuario) ? data.usuario[0] : data.usuario
  if (!usuario) return null

  // Último uso: para o administrador ver se o conector está mesmo em uso.
  // Falhar aqui não impede o trabalho.
  await supabase.from("chaves_api").update({ ultimo_uso_em: new Date().toISOString() }).eq("id", data.id)

  return toCamelCase(usuario) as CurrentUser
}
