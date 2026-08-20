// ─────────────────────────────────────────────────────────
// Domínio: etiqueta de perícia
//
// O `ProcessoStatus` descreve o processo inteiro e serve para todos os
// benefícios. No auxílio por incapacidade, porém, a pergunta diária é
// outra e mais curta: "já marcou? já foi? tem que pedir prorrogação?".
// Uma etiqueta separada responde isso sem sequestrar o status geral.
// ─────────────────────────────────────────────────────────

export const SITUACOES_PERICIA = [
  "MARCAR_PERICIA",
  "PERICIA_MARCADA",
  "PRORROGACAO",
] as const

export type SituacaoPericia = (typeof SITUACOES_PERICIA)[number]

export const PERICIA_LABEL: Record<SituacaoPericia, string> = {
  MARCAR_PERICIA: "Marcar perícia",
  PERICIA_MARCADA: "Perícia marcada",
  PRORROGACAO: "Prorrogação",
}

export function isSituacaoPericia(valor?: string | null): valor is SituacaoPericia {
  return SITUACOES_PERICIA.includes(valor as SituacaoPericia)
}

/**
 * Enquanto ninguém etiquetou o processo à mão, a etiqueta é deduzida
 * do status. Um auxílio-doença sem etiqueta nenhuma na fila seria pior
 * que uma dedução: a tela existe para dizer o que fazer em seguida.
 */
export function periciaSugerida(status: string): SituacaoPericia {
  if (status === "PERICIA_MARCADA") return "PERICIA_MARCADA"
  if (status === "PERICIA_CONCLUIDA" || status === "BENEFICIO_CONCEDIDO") {
    return "PRORROGACAO"
  }
  return "MARCAR_PERICIA"
}
