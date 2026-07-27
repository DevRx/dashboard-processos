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

/**
 * As únicas categorias que podem sair do sistema para leitura por IA.
 *
 * Lista de permissão, não de bloqueio: categoria nova nasce fora dela
 * e só entra por decisão explícita. O contrário — bloquear o que se
 * lembrou de bloquear — vaza no dia em que alguém cria "CARTEIRA_SUS"
 * e esquece de somar à lista.
 *
 * RG, CPF e comprovante de residência ficam de fora porque são só
 * identificação: não há o que a IA extraia deles que compense mandar
 * o documento inteiro para fora. O laudo é o oposto — CID, prazo de
 * afastamento e CRM são exatamente o trabalho manual que se quer
 * eliminar.
 */
export const CATEGORIAS_LEGIVEIS_POR_IA: readonly CategoriaDocumento[] = [
  "LAUDO_MEDICO",
]

export function podeSerLidoPorIa(categoria: unknown): boolean {
  return (
    isCategoriaDocumento(categoria) &&
    CATEGORIAS_LEGIVEIS_POR_IA.includes(categoria)
  )
}

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
