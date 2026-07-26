import "server-only"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import type { FonteIntegracao } from "@/lib/integracoes/contrato"

/**
 * Porteiro de base legal.
 *
 * Dado previdenciário é dado pessoal sensível (art. 5º, II). Tratar
 * sensível exige uma das hipóteses do art. 11 — não basta ter o
 * documento em mãos. Por isso a rota de importação chama
 * `verificarBaseLegal` antes de qualquer parser rodar: se não há base
 * legal vigente para aquele titular e aquela fonte, o dado não entra.
 *
 * O DataJud não passa por aqui: ato processual é público por lei.
 */

export type BaseLegalLGPD =
  | "CONSENTIMENTO"
  | "OBRIGACAO_LEGAL"
  | "EXERCICIO_DIREITOS"

export const BASE_LEGAL_LABELS: Record<BaseLegalLGPD, string> = {
  CONSENTIMENTO: "Consentimento do titular (art. 11, I)",
  OBRIGACAO_LEGAL: "Cumprimento de obrigação legal (art. 11, II, “a”)",
  EXERCICIO_DIREITOS:
    "Exercício regular de direitos — procuração (art. 11, II, “d”)",
}

export type Consentimento = {
  id: string
  userId: string
  clienteId: string
  baseLegal: BaseLegalLGPD
  finalidade: string
  procuracaoRef: string | null
  fontes: FonteIntegracao[]
  vigenteDesde: string
  retencaoAte: string | null
  revogadoEm: string | null
  revogadoMotivo: string | null
}

export type MotivoRecusa =
  | "sem_base_legal"
  | "fonte_nao_autorizada"
  | "retencao_expirada"
  | "erro_consulta"

export const MOTIVO_RECUSA_MENSAGEM: Record<MotivoRecusa, string> = {
  sem_base_legal:
    "Este cliente não tem base legal vigente para tratamento de dado previdenciário. Registre a procuração ou o consentimento antes de importar.",
  fonte_nao_autorizada:
    "A base legal registrada para este cliente não autoriza esta fonte. Amplie o escopo do consentimento ou use outra fonte.",
  retencao_expirada:
    "O prazo de retenção acordado com o titular já venceu. Renove a base legal antes de importar novos dados.",
  erro_consulta: "Não foi possível verificar a base legal agora. Tente novamente.",
}

/** Consentimento não revogado do cliente, se houver. */
export async function buscarConsentimentoVigente(
  clienteId: string,
  userId: string
): Promise<Consentimento | null> {
  const { data, error } = await supabase
    .from("consentimentos_lgpd")
    .select("*")
    .eq("cliente_id", clienteId)
    .eq("user_id", userId)
    .is("revogado_em", null)
    .maybeSingle()

  if (error || !data) return null
  return toCamelCase(data) as Consentimento
}

/** Histórico completo, incluindo revogados — é a trilha de prova. */
export async function listarConsentimentos(
  clienteId: string,
  userId: string
): Promise<Consentimento[]> {
  const { data, error } = await supabase
    .from("consentimentos_lgpd")
    .select("*")
    .eq("cliente_id", clienteId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error || !data) return []
  return toCamelCase(data) as Consentimento[]
}

export async function verificarBaseLegal(params: {
  clienteId: string
  userId: string
  fonte: FonteIntegracao
}): Promise<
  { ok: true; consentimento: Consentimento } | { ok: false; motivo: MotivoRecusa }
> {
  const consentimento = await buscarConsentimentoVigente(
    params.clienteId,
    params.userId
  )

  if (!consentimento) {
    return { ok: false, motivo: "sem_base_legal" }
  }

  if (!consentimento.fontes.includes(params.fonte)) {
    return { ok: false, motivo: "fonte_nao_autorizada" }
  }

  // Retenção vencida significa que o combinado com o titular acabou.
  // Continuar importando sob essa base seria tratar sem finalidade
  // vigente (art. 15, I).
  if (consentimento.retencaoAte) {
    const hoje = new Date().toISOString().slice(0, 10)
    if (consentimento.retencaoAte < hoje) {
      return { ok: false, motivo: "retencao_expirada" }
    }
  }

  return { ok: true, consentimento }
}
