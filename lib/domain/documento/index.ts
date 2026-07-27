// ─────────────────────────────────────────────────────────
// Domínio: categorias de documento do cliente
//
// A pasta do cliente só é útil se der para achar as coisas pelo tipo.
// Nome de arquivo não serve: chega como "scan_0012.pdf" e
// "WhatsApp Image 2026-07-27.jpeg".
//
// A ordem abaixo é a ordem de exibição, e não é alfabética de
// propósito: começa pelo que o INSS pede em todo requerimento e
// termina no que é específico de algumas espécies.
// ─────────────────────────────────────────────────────────

export type CategoriaDocumento =
  | "PROCURACAO"
  | "IDENTIFICACAO"
  | "CPF"
  | "COMPROVANTE_RESIDENCIA"
  | "CNIS"
  | "CARTEIRA_TRABALHO"
  | "LAUDO_MEDICO"
  | "EXAME"
  | "CERTIDAO"
  | "CARTA_BENEFICIO"
  | "OUTRO"

export const CATEGORIAS_DOCUMENTO: readonly CategoriaDocumento[] = [
  "PROCURACAO",
  "IDENTIFICACAO",
  "CPF",
  "COMPROVANTE_RESIDENCIA",
  "CNIS",
  "CARTEIRA_TRABALHO",
  "LAUDO_MEDICO",
  "EXAME",
  "CERTIDAO",
  "CARTA_BENEFICIO",
  "OUTRO",
]

export const CATEGORIA_DOCUMENTO_LABELS: Record<CategoriaDocumento, string> = {
  PROCURACAO: "Procuração",
  IDENTIFICACAO: "RG / CNH",
  CPF: "CPF",
  COMPROVANTE_RESIDENCIA: "Comprovante de residência",
  CNIS: "Extrato CNIS",
  CARTEIRA_TRABALHO: "Carteira de trabalho",
  LAUDO_MEDICO: "Laudo médico",
  EXAME: "Exame",
  CERTIDAO: "Certidão",
  CARTA_BENEFICIO: "Carta do INSS",
  OUTRO: "Outro",
}

/**
 * O que o INSS pede em praticamente todo requerimento. A pasta que não
 * tem isto está incompleta, independentemente da espécie.
 */
export const CATEGORIAS_BASICAS: readonly CategoriaDocumento[] = [
  "IDENTIFICACAO",
  "CPF",
  "COMPROVANTE_RESIDENCIA",
  "PROCURACAO",
]

export function isCategoriaDocumento(valor: unknown): valor is CategoriaDocumento {
  return (
    typeof valor === "string" &&
    Object.prototype.hasOwnProperty.call(CATEGORIA_DOCUMENTO_LABELS, valor)
  )
}

export function getCategoriaLabel(valor: string): string {
  return isCategoriaDocumento(valor)
    ? CATEGORIA_DOCUMENTO_LABELS[valor]
    : String(valor)
}

/** Categorias básicas ainda ausentes na pasta do cliente. */
export function faltandoNaPasta(
  presentes: string[]
): CategoriaDocumento[] {
  return CATEGORIAS_BASICAS.filter((c) => !presentes.includes(c))
}
