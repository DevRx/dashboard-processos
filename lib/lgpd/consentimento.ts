import "server-only"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import type { FonteIntegracao } from "@/lib/integracoes/contrato"
import { idsDoEscritorio } from "@/lib/escritorio"

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
  /**
   * Autoriza mandar documentos do titular para leitura por IA.
   *
   * Separado das `fontes` de propósito: aquelas dizem de onde o dado
   * vem, esta diz que ele *sai* — para um operador em outro país
   * (art. 33). Consentir em consultar o INSS não é consentir nisso.
   */
  iaAutorizada: boolean
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
  clienteId: string
): Promise<Consentimento | null> {
  const { data, error } = await supabase
    .from("consentimentos_lgpd")
    .select("*")
    .eq("cliente_id", clienteId)
    .in("user_id", await idsDoEscritorio())
    .is("revogado_em", null)
    .maybeSingle()

  if (error || !data) return null
  return toCamelCase(data) as Consentimento
}

/** Histórico completo, incluindo revogados — é a trilha de prova. */
export async function listarConsentimentos(
  clienteId: string
): Promise<Consentimento[]> {
  const { data, error } = await supabase
    .from("consentimentos_lgpd")
    .select("*")
    .eq("cliente_id", clienteId)
    .in("user_id", await idsDoEscritorio())
    .order("created_at", { ascending: false })

  if (error || !data) return []
  return toCamelCase(data) as Consentimento[]
}

/**
 * Avalia um consentimento já carregado.
 *
 * `fonte` é opcional porque a verificação acontece em duas etapas: a
 * existência da base legal e o prazo de retenção são checados *antes*
 * de o sistema olhar o documento colado, e o escopo de fonte só pode
 * ser checado depois, quando a detecção revelou de que sistema o
 * documento veio. Assim nenhum texto é inspecionado sem base legal
 * vigente, e nenhuma fonte fora do escopo chega ao parser.
 */
export function avaliarBaseLegal(
  consentimento: Consentimento | null,
  fonte?: FonteIntegracao
): { ok: true; consentimento: Consentimento } | { ok: false; motivo: MotivoRecusa } {
  if (!consentimento) {
    return { ok: false, motivo: "sem_base_legal" }
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

  if (fonte && !consentimento.fontes.includes(fonte)) {
    return { ok: false, motivo: "fonte_nao_autorizada" }
  }

  return { ok: true, consentimento }
}
