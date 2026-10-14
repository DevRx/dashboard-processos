import { categorizarBeneficio } from "../beneficio/categorias"
import { municipioDoEndereco } from "../localizacao"

// ─────────────────────────────────────────────────────────
// Domínio: as ações judiciais por família e por estado
//
// O desenho do Zeca (14/10/2026) organiza o quadro "Processos
// judiciais" em quatro colunas, por tipo de caso — não por fase:
//
//   BPC deficiente · Processos de incapacidade · Outros benefícios ·
//   Outros procedimentos
//
// e, no alto, uma faixa com a conta dos processos ativos por lugar:
// DF, GO, Minas, SP e Nordeste. É a leitura que o escritório faz da
// própria carteira ("quantas ações de incapacidade temos em Goiás?"),
// enquanto as fases dizem em que ponto cada ação está. As duas
// leituras valem para os mesmos processos: nada aqui é gravado.
//
// A família sai do texto do benefício, pela mesma regra do
// administrativo (lib/domain/beneficio/categorias.ts), reagrupada:
// aposentadoria, pensão, maternidade e o resto cabem em "outros
// benefícios"; o que não é benefício (revisão, cessação, recurso) é
// "outros procedimentos". Incapacidade junta auxílio-doença,
// aposentadoria por incapacidade e auxílio-acidente — todos passam
// pela perícia judicial.
// ─────────────────────────────────────────────────────────

export const FAMILIAS_JUDICIAIS = [
  "BPC_DEFICIENTE",
  "INCAPACIDADE",
  "OUTROS_BENEFICIOS",
  "OUTROS_PROCEDIMENTOS",
] as const

export type FamiliaJudicial = (typeof FAMILIAS_JUDICIAIS)[number]

export const FAMILIA_LABEL: Record<FamiliaJudicial, string> = {
  BPC_DEFICIENTE: "BPC deficiente",
  INCAPACIDADE: "Processos de incapacidade",
  OUTROS_BENEFICIOS: "Outros benefícios",
  OUTROS_PROCEDIMENTOS: "Outros procedimentos",
}

export const FAMILIA_DESCRICAO: Record<FamiliaJudicial, string> = {
  BPC_DEFICIENTE: "Pessoa com deficiência — perícia médica e social",
  INCAPACIDADE: "Auxílio-doença, incapacidade permanente e auxílio-acidente",
  OUTROS_BENEFICIOS: "Aposentadorias, pensão, maternidade, BPC do idoso",
  OUTROS_PROCEDIMENTOS: "Revisão, cessação, restabelecimento e demais ações",
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

export function familiaDoBeneficio(beneficio?: string | null): FamiliaJudicial {
  const t = normalizar(beneficio ?? "")
  // Antes da regra do administrativo: lá o auxílio-acidente e a
  // aposentadoria por incapacidade caem noutras famílias, e aqui os
  // dois passam pela perícia — são incapacidade.
  if (/\bincapacidade\b/.test(t) || /acidente/.test(t)) return "INCAPACIDADE"

  switch (categorizarBeneficio(beneficio)) {
    case "BPC_DEFICIENTE":
      return "BPC_DEFICIENTE"
    case "AUXILIO_DOENCA":
      return "INCAPACIDADE"
    case "PROCEDIMENTO_ADM":
      return "OUTROS_PROCEDIMENTOS"
    default:
      return "OUTROS_BENEFICIOS"
  }
}

// ── Por estado ────────────────────────────────────────────

/** As regiões da faixa de contagem, na ordem do desenho. */
export const REGIOES_JUDICIAIS = ["DF", "GO", "MG", "SP", "NORDESTE", "OUTROS"] as const

export type RegiaoJudicial = (typeof REGIOES_JUDICIAIS)[number]

export const REGIAO_LABEL: Record<RegiaoJudicial, string> = {
  DF: "DF",
  GO: "GO",
  MG: "Minas",
  SP: "SP",
  NORDESTE: "Nordeste",
  OUTROS: "Outros",
}

const UFS_NORDESTE = new Set(["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"])

/** "TRF1 — Seção Judiciária do DF", "TJGO", "JEF de Luziânia/GO" → a UF, quando o texto diz. */
function ufDoTexto(texto?: string | null): string | null {
  if (!texto?.trim()) return null
  const t = normalizar(texto)

  // Sigla solta ("- GO", "/GO", "SJGO", "TJMG", "TRF1 DF").
  const solta = t.match(/\b(?:sj|tj|trt|tre)?(ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)\b/)
  if (solta) return solta[1].toUpperCase()

  // Nome por extenso ("Seção Judiciária de Goiás", "Minas Gerais").
  const extenso: [RegExp, string][] = [
    [/distrito federal|brasilia/, "DF"],
    [/goias/, "GO"],
    [/minas/, "MG"],
    [/sao paulo/, "SP"],
    [/bahia/, "BA"],
    [/ceara/, "CE"],
    [/pernambuco/, "PE"],
    [/maranhao/, "MA"],
    [/piaui/, "PI"],
    [/paraiba/, "PB"],
    [/rio grande do norte/, "RN"],
    [/alagoas/, "AL"],
    [/sergipe/, "SE"],
  ]
  for (const [re, uf] of extenso) if (re.test(t)) return uf

  return municipioDoEndereco(texto)?.uf ?? null
}

/**
 * A UF da ação: a comarca diz primeiro (é o lugar), depois a vara e o
 * tribunal. Sem nenhum dos três, fica sem estado.
 */
export function ufDoProcesso(p: {
  comarca?: string | null
  vara?: string | null
  tribunal?: string | null
}): string | null {
  return ufDoTexto(p.comarca) ?? ufDoTexto(p.vara) ?? ufDoTexto(p.tribunal)
}

export function regiaoDaUf(uf?: string | null): RegiaoJudicial {
  if (!uf) return "OUTROS"
  if (uf === "DF" || uf === "GO" || uf === "MG" || uf === "SP") return uf
  if (UFS_NORDESTE.has(uf)) return "NORDESTE"
  return "OUTROS"
}
