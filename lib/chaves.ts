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
/**
 * Chave → conta fica na memória da instância por 60 s: o Claude faz
 * várias chamadas seguidas com a mesma chave, e cada uma custava uma
 * leitura e uma gravação ("último uso") antes de a ferramenta começar.
 * Revogar uma chave passa a valer em até um minuto. O "último uso" é
 * gravado no máximo uma vez a cada 5 minutos por chave.
 */
const VALIDADE_MS = 60_000
const ULTIMO_USO_MS = 5 * 60_000
const lembradas = new Map<string, { em: number; id: string; usuario: CurrentUser; usoGravadoEm: number }>()

export async function usuarioDaChave(chave: string | null): Promise<CurrentUser | null> {
  if (!chave || !chave.startsWith(PREFIXO) || chave.length < 20) return null

  const hash = resumoDaChave(chave)
  const agora = Date.now()
  let lembrada = lembradas.get(hash)

  if (!lembrada || agora - lembrada.em > VALIDADE_MS) {
    const { data, error } = await supabase
      .from("chaves_api")
      .select("id, revogada_em, usuario:users!chaves_api_usuario_id_fkey(id, name, email, role)")
      .eq("hash", hash)
      .maybeSingle()

    if (error) {
      console.error("Chave do conector:", error.message)
      return null
    }
    if (!data || data.revogada_em) {
      lembradas.delete(hash)
      return null
    }

    const usuario = Array.isArray(data.usuario) ? data.usuario[0] : data.usuario
    if (!usuario) return null

    lembrada = { em: agora, id: data.id as string, usuario: toCamelCase(usuario) as CurrentUser, usoGravadoEm: lembrada?.usoGravadoEm ?? 0 }
    lembradas.set(hash, lembrada)
  }

  // Último uso: para o administrador ver se o conector está mesmo em uso.
  // Falhar aqui não impede o trabalho.
  if (agora - lembrada.usoGravadoEm > ULTIMO_USO_MS) {
    lembrada.usoGravadoEm = agora
    void supabase
      .from("chaves_api")
      .update({ ultimo_uso_em: new Date(agora).toISOString() })
      .eq("id", lembrada.id)
      .then(({ error }) => {
        if (error) console.error("Último uso da chave:", error.message)
      })
  }

  return lembrada.usuario
}

/** Depois de revogar ou criar chave: a próxima chamada vai ao banco. */
export function esquecerChaves() {
  lembradas.clear()
}
