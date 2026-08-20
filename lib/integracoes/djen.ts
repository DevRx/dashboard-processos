import "server-only"
import type { Resultado } from "@/lib/integracoes/contrato"

// ─────────────────────────────────────────────────────────
// DJEN — Diário de Justiça Eletrônico Nacional (CNJ)
//
// API pública de consulta de comunicações processuais, sem cadastro:
// https://comunicaapi.pje.jus.br/api/v1/comunicacao
//
// Mesma natureza do DataJud e por isso no mesmo modo `consulta`: são
// atos publicados em diário oficial, públicos por lei. O que se busca
// aqui é o que foi publicado em nome de uma OAB — é a caixa de
// entrada do escritório, não dado de titular obtido por procuração.
//
// Não confundir com o DataJud (lib/integracoes/datajud.ts): lá estão
// os dados do processo (classe, órgão, movimentos); aqui estão as
// intimações, que são as que têm prazo correndo.
//
// A contagem do prazo em si mora em lib/domain/prazo: é regra do CPC
// e do calendário forense, não do formato desta API.
// ─────────────────────────────────────────────────────────

const DJEN_BASE = "https://comunicaapi.pje.jus.br/api/v1/comunicacao"

/** Teto de segurança: a consulta é por intervalo, não por "tudo". */
const MAX_PAGINAS = 20
const ITENS_POR_PAGINA = 100

export type ComunicacaoDjen = {
  idDjen: number
  numeroProcesso: string | null
  numeroProcessoMascara: string | null
  siglaTribunal: string | null
  nomeOrgao: string | null
  tipoComunicacao: string | null
  tipoDocumento: string | null
  nomeClasse: string | null
  /** Parte representada, quando o diário a identifica. */
  destinatario: string | null
  dataDisponibilizacao: string
  texto: string
  link: string | null
  /** Prazo lido do texto — `null` quando não há um explícito. */
  prazo: PrazoLido | null
}

type ItemBruto = {
  id: number
  data_disponibilizacao: string
  siglaTribunal?: string
  tipoComunicacao?: string
  nomeOrgao?: string
  texto?: string
  numero_processo?: string
  numeroprocessocommascara?: string
  link?: string
  tipoDocumento?: string
  nomeClasse?: string
  destinatarios?: { nome?: string; polo?: string }[]
}

const NUMERO_POR_EXTENSO: Record<string, number> = {
  um: 1,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  quinze: 15,
  vinte: 20,
  trinta: 30,
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export type PrazoLido = {
  dias: number
  /** Trecho do diário de onde o número saiu, para conferência. */
  trecho: string
}

/**
 * Lê o prazo do corpo da intimação.
 *
 * O diário escreve de várias formas — "no prazo de 15 (quinze) dias",
 * "Prazo: 10 dias", "prazo de 05 (cinco) dias". Todas têm a palavra
 * "prazo" a poucas letras de um número seguido de "dias", e é esse par
 * que se procura, numa janela curta: solta, ela casa com o "15
 * (quinze) dias" de qualquer parágrafo perdido da sentença.
 *
 * Vale o primeiro achado — é o do ato comunicado. E o trecho volta
 * junto porque nem todo prazo do texto é do escritório: "no prazo de
 * 60 dias corridos" costuma ser do INSS para implantar o benefício, e
 * quem lê a frase percebe isso na hora. A tela mostra o trecho ao lado
 * do número justamente para essa conferência.
 *
 * Devolve `null` sem forçar palpite: intimação sem prazo explícito
 * existe, e inventar 15 dias ali é pior que dizer "confira".
 */
export function extrairPrazo(texto: string): PrazoLido | null {
  const t = normalizar(texto)

  const padroes = [
    /prazo[^.;]{0,25}?(\d{1,3})\s*(?:\([a-z\s]+\))?\s*dias/,
    /prazo[^.;]{0,25}?\(?([a-z]+)\)?\s*dias/,
  ]

  for (const padrao of padroes) {
    const achado = t.match(padrao)
    if (!achado || achado.index === undefined) continue

    const bruto = achado[1]
    const numero = /^\d+$/.test(bruto)
      ? Number(bruto)
      : NUMERO_POR_EXTENSO[bruto]

    if (!numero || numero <= 0 || numero > 365) continue

    // O trecho sai do texto original (com acento e caixa), não do
    // normalizado: quem confere lê o diário, não a nossa cópia.
    const inicio = Math.max(0, achado.index - 45)
    const fim = Math.min(texto.length, achado.index + achado[0].length + 55)

    return {
      dias: numero,
      trecho: `…${texto.slice(inicio, fim).replace(/\s+/g, " ").trim()}…`,
    }
  }

  return null
}

function converter(item: ItemBruto): ComunicacaoDjen {
  const texto = item.texto ?? ""
  // Polo ativo primeiro: é o cliente do escritório na maioria das
  // ações previdenciárias, que são movidas contra o INSS.
  const parte =
    item.destinatarios?.find((d) => d.polo === "A")?.nome ??
    item.destinatarios?.[0]?.nome ??
    null

  return {
    idDjen: item.id,
    numeroProcesso: item.numero_processo ?? null,
    numeroProcessoMascara: item.numeroprocessocommascara ?? null,
    siglaTribunal: item.siglaTribunal ?? null,
    nomeOrgao: item.nomeOrgao ?? null,
    tipoComunicacao: item.tipoComunicacao ?? null,
    tipoDocumento: item.tipoDocumento ?? null,
    nomeClasse: item.nomeClasse ?? null,
    destinatario: parte,
    dataDisponibilizacao: item.data_disponibilizacao,
    texto,
    link: item.link ?? null,
    prazo: extrairPrazo(texto),
  }
}

/**
 * Comunicações publicadas em nome de uma OAB, num intervalo de datas.
 *
 * Pagina até esgotar o intervalo. O teto existe para uma consulta
 * ampla demais não virar um laço infinito contra um serviço público.
 */
export async function consultarComunicacoesDjen(params: {
  numeroOab: string
  ufOab: string
  dataInicio: string
  dataFim: string
}): Promise<Resultado<ComunicacaoDjen[]>> {
  const oab = params.numeroOab.replace(/\D/g, "")
  const uf = params.ufOab.trim().toUpperCase()

  if (!oab || uf.length !== 2) {
    return { ok: false, motivo: "invalid_format" }
  }

  const comunicacoes: ComunicacaoDjen[] = []

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const url = new URL(DJEN_BASE)
    url.searchParams.set("numeroOab", oab)
    url.searchParams.set("ufOab", uf)
    url.searchParams.set("dataDisponibilizacaoInicio", params.dataInicio)
    url.searchParams.set("dataDisponibilizacaoFim", params.dataFim)
    url.searchParams.set("itensPorPagina", String(ITENS_POR_PAGINA))
    url.searchParams.set("pagina", String(pagina))

    let resposta: Response
    try {
      resposta = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      })
    } catch {
      return { ok: false, motivo: "djen_indisponivel" }
    }

    if (!resposta.ok) {
      return { ok: false, motivo: "djen_indisponivel" }
    }

    const json = (await resposta.json()) as {
      status?: string
      items?: ItemBruto[]
    }

    const itens = json.items ?? []
    comunicacoes.push(...itens.map(converter))

    if (itens.length < ITENS_POR_PAGINA) break
  }

  return { ok: true, dados: comunicacoes }
}
