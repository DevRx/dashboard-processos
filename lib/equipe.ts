import "server-only"
import { supabase } from "@/lib/supabase/server"

/**
 * A equipe do escritório, lida uma vez por minuto — e não uma vez por
 * pedido.
 *
 * Quase toda rota começava com duas ou três leituras da tabela `users`:
 * quem sou eu (lib/auth.ts), quem é do escritório (lib/escritorio.ts),
 * quem pode ser responsável (lib/fluxo/servidor.ts). O teste de estresse
 * de 15/10/2026 mostrou que, num clique de nove idas ao banco, três eram
 * essas. A tabela tem meia dúzia de linhas e muda quando alguém entra
 * na equipe — uma vez por mês, não por clique.
 *
 * O cache vive na memória de cada instância do servidor (na Vercel,
 * cada função aquecida tem o seu) e dura 60 segundos: uma conta criada
 * ou um papel trocado valem em até um minuto em todas as instâncias — e
 * na hora na instância que fez a mudança, que chama `esquecerEquipe()`.
 */

export type MembroDaEquipe = { id: string; name: string; email: string; role: string }

const VALIDADE_MS = 60_000

let lido: { em: number; membros: MembroDaEquipe[] } | null = null
let lendo: Promise<MembroDaEquipe[]> | null = null

async function lerDoBanco(): Promise<MembroDaEquipe[]> {
  const { data, error } = await supabase.from("users").select("id, name, email, role").order("name", { ascending: true })
  if (error) {
    console.error("Equipe:", error.message)
    throw error
  }
  return (data ?? []) as MembroDaEquipe[]
}

/** Todos da equipe. Falhando o banco, vale a última leitura boa, se houver. */
export async function equipe(): Promise<MembroDaEquipe[]> {
  if (lido && Date.now() - lido.em < VALIDADE_MS) return lido.membros
  if (!lendo) {
    lendo = lerDoBanco()
      .then((membros) => {
        lido = { em: Date.now(), membros }
        return membros
      })
      .catch((e) => {
        if (lido) return lido.membros
        throw e
      })
      .finally(() => {
        lendo = null
      })
  }
  return lendo
}

/** Um membro pelo id. Quem acabou de ser criado ainda não está no cache: relê uma vez. */
export async function membroDaEquipe(id: string): Promise<MembroDaEquipe | null> {
  const achado = (await equipe()).find((u) => u.id === id)
  if (achado) return achado
  if (lido && Date.now() - lido.em < VALIDADE_MS) {
    esquecerEquipe()
    return (await equipe()).find((u) => u.id === id) ?? null
  }
  return null
}

/** Depois de criar conta ou trocar papel: a próxima leitura vai ao banco. */
export function esquecerEquipe() {
  lido = null
}
