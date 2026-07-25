// ─────────────────────────────────────────────────────────
// Domínio: status do Processo
//
// Fonte única de verdade para o vocabulário de status.
// Aqui vivem apenas tipo, ordem, rótulos e conversores.
//
// Cores e variantes visuais NÃO pertencem a este módulo por
// enquanto: hoje `StatusBadge`, `ProcessosStatusChart` e
// `ProcessTable` usam paletas divergentes, e unificá-las
// mudaria a interface. Essa decisão é da Sprint de Design System.
// ─────────────────────────────────────────────────────────

export type ProcessoStatus =
  | "EM_ANALISE"
  | "AGUARDANDO_INSS"
  | "PERICIA_MARCADA"
  | "PERICIA_CONCLUIDA"
  | "BENEFICIO_CONCEDIDO"
  | "RECUSADO"
  | "CONCLUIDO"
  | "ARQUIVADO"

/**
 * Ordem oficial de exibição, do início ao fim do ciclo de vida.
 *
 * Esta ordem é visível ao usuário: alimenta os <select> de status
 * nas telas de Processos e de detalhe do Cliente. Alterá-la muda a
 * ordem das opções nesses formulários.
 */
export const PROCESSO_STATUS_VALUES: readonly ProcessoStatus[] = [
  "EM_ANALISE",
  "AGUARDANDO_INSS",
  "PERICIA_MARCADA",
  "PERICIA_CONCLUIDA",
  "BENEFICIO_CONCEDIDO",
  "RECUSADO",
  "CONCLUIDO",
  "ARQUIVADO",
]

export const PROCESSO_STATUS_LABELS: Record<ProcessoStatus, string> = {
  EM_ANALISE: "Em análise",
  AGUARDANDO_INSS: "Aguardando INSS",
  PERICIA_MARCADA: "Perícia marcada",
  PERICIA_CONCLUIDA: "Perícia concluída",
  BENEFICIO_CONCEDIDO: "Benefício concedido",
  RECUSADO: "Recusado",
  CONCLUIDO: "Concluído",
  ARQUIVADO: "Arquivado",
}

/** Verifica se um valor arbitrário é um status conhecido. */
export function isProcessoStatus(value: unknown): value is ProcessoStatus {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PROCESSO_STATUS_LABELS, value)
  )
}

/**
 * Converte um status em rótulo legível.
 *
 * Aceita `string` porque os dados chegam do Supabase sem garantia de
 * tipo. Status desconhecido retorna o próprio valor, preservando o
 * comportamento atual das telas (`LABELS[status] || status`).
 */
export function getProcessoStatusLabel(status: ProcessoStatus | string): string {
  return isProcessoStatus(status) ? PROCESSO_STATUS_LABELS[status] : String(status)
}

/** Ordena status pela ordem oficial do ciclo de vida. */
export function compareProcessoStatus(
  a: ProcessoStatus | string,
  b: ProcessoStatus | string
): number {
  const posicao = (s: ProcessoStatus | string) => {
    const i = PROCESSO_STATUS_VALUES.indexOf(s as ProcessoStatus)
    return i === -1 ? PROCESSO_STATUS_VALUES.length : i
  }
  return posicao(a) - posicao(b)
}
