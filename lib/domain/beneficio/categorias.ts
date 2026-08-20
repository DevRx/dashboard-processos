// ─────────────────────────────────────────────────────────
// Domínio: agrupamento das espécies em famílias de trabalho
//
// A tela Administrativo não pergunta "qual a espécie exata?" — ela
// pergunta "o que tem na mesa hoje?". E na mesa o trabalho se organiza
// por família: BPC do deficiente anda com perícia médica e social,
// auxílio-doença com perícia médica, maternidade com certidão.
// `beneficio` é texto livre (o GERID devolve a redação dele), então a
// classificação é por reconhecimento do texto, não por igualdade.
//
// BPC do idoso não mora aqui: ele não tem perícia nem laudo, o
// trabalho é renda per capita — por isso desce para "Outros".
// ─────────────────────────────────────────────────────────

export const CATEGORIAS_ADMINISTRATIVO = [
  "APOSENTADORIA",
  "BPC_DEFICIENTE",
  "AUXILIO_DOENCA",
  "PENSAO",
  "MATERNIDADE",
  "PROCEDIMENTO_ADM",
  "OUTROS",
] as const

export type CategoriaAdministrativo = (typeof CATEGORIAS_ADMINISTRATIVO)[number]

export const CATEGORIA_LABEL: Record<CategoriaAdministrativo, string> = {
  APOSENTADORIA: "Aposentadoria",
  BPC_DEFICIENTE: "BPC/LOAS — Deficiente",
  AUXILIO_DOENCA: "Auxílio-Doença",
  PENSAO: "Pensão",
  MATERNIDADE: "Salário-Maternidade",
  PROCEDIMENTO_ADM: "Procedimento Adm.",
  OUTROS: "Outros Benefícios",
}

export const CATEGORIA_DESCRICAO: Record<CategoriaAdministrativo, string> = {
  APOSENTADORIA: "Idade, tempo de contribuição, especial e rural",
  BPC_DEFICIENTE: "Pessoa com deficiência — perícia médica e social",
  AUXILIO_DOENCA: "Incapacidade temporária — acompanhamento de perícia",
  PENSAO: "Pensão por morte",
  MATERNIDADE: "Salário-maternidade urbano e rural",
  PROCEDIMENTO_ADM: "Revisão, recurso, prorrogação e demais requerimentos",
  OUTROS: "BPC do idoso, auxílio-acidente, reclusão e demais casos",
}

/**
 * Endereço de cada família. A URL é o que a equipe vai mandar por
 * mensagem ("olha a fila do auxílio"), então é legível e estável — não
 * o valor do enum.
 */
export const CATEGORIA_SLUG: Record<CategoriaAdministrativo, string> = {
  APOSENTADORIA: "aposentadoria",
  BPC_DEFICIENTE: "bpc-deficiente",
  AUXILIO_DOENCA: "auxilio-doenca",
  PENSAO: "pensao",
  MATERNIDADE: "salario-maternidade",
  PROCEDIMENTO_ADM: "procedimento-adm",
  OUTROS: "outros-beneficios",
}

export function categoriaPorSlug(
  slug: string
): CategoriaAdministrativo | null {
  const achada = CATEGORIAS_ADMINISTRATIVO.find(
    (c) => CATEGORIA_SLUG[c] === slug
  )
  return achada ?? null
}

/** Tira acento e caixa: "Salário-Maternidade" e "salario maternidade" viram o mesmo. */
function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

/**
 * A ordem importa. "BPC do idoso" precisa ser reconhecido antes da
 * regra geral de BPC; "auxílio-acidente" cai em OUTROS antes que
 * "auxílio" o puxe para AUXILIO_DOENCA; e "aposentadoria por
 * incapacidade permanente" é aposentadoria, não auxílio-doença.
 */
export function categorizarBeneficio(
  beneficio?: string | null
): CategoriaAdministrativo {
  if (!beneficio?.trim()) return "PROCEDIMENTO_ADM"

  const t = normalizar(beneficio)
  const ehBpc = /\b(bpc|loas)\b/.test(t)

  if (ehBpc && (t.includes("idoso") || t.includes("idade avancada"))) return "OUTROS"
  if (ehBpc) return "BPC_DEFICIENTE"

  if (t.includes("maternidade")) return "MATERNIDADE"
  if (t.includes("pensao")) return "PENSAO"
  if (t.includes("auxilio-acidente") || t.includes("auxilio acidente")) return "OUTROS"
  if (t.includes("aposentadoria")) return "APOSENTADORIA"

  if (
    t.includes("incapacidade temporaria") ||
    t.includes("auxilio-doenca") ||
    t.includes("auxilio doenca") ||
    t.includes("doenca")
  ) {
    return "AUXILIO_DOENCA"
  }

  if (
    t.includes("revisao") ||
    t.includes("recurso") ||
    t.includes("requerimento") ||
    t.includes("procedimento") ||
    t.includes("prorrogacao") ||
    t.includes("reativacao") ||
    t.includes("justificacao") ||
    t.includes("cessacao")
  ) {
    return "PROCEDIMENTO_ADM"
  }

  return "OUTROS"
}
