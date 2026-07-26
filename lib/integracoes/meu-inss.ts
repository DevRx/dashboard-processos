import "server-only"
import {
  dataBrParaIso,
  moedaBrParaNumero,
  normalizarTexto,
  somenteDigitos,
  type AdapterImportacao,
  type Resultado,
} from "@/lib/integracoes/contrato"

/**
 * Importação assistida dos documentos do Meu INSS.
 *
 * O operador abre o documento no Meu INSS (login gov.br do titular)
 * ou no INSS Digital/GERID (procuração cadastrada, sem precisar da
 * senha do segurado) e cola o texto aqui. Não há chamada de rede:
 * este módulo só interpreta texto que já estava legitimamente na tela
 * de quem operou.
 *
 * Minimização (art. 6º, III): os parsers descartam de propósito campos
 * que o dashboard não usa — nome da mãe, NIT completo, endereço do
 * titular, dados bancários. CPF sai sempre mascarado; a identificação
 * do titular no sistema é o `cliente_id`, não o CPF.
 *
 * Os layouts abaixo seguem os extratos do Meu INSS em vigor. São
 * tolerantes a variação de espaçamento porque texto copiado de PDF
 * quebra de formas imprevisíveis, mas convém revalidar os regexes
 * contra um documento real quando o INSS alterar o modelo.
 */

/** Mantém só os 3 últimos dígitos: "***.***.789-**". */
function mascararCpf(cpf: string): string | undefined {
  const d = somenteDigitos(cpf)
  if (d.length !== 11) return undefined
  return `***.***.${d.slice(6, 9)}-**`
}

// ─────────────────────────────────────────────────────────
// CNIS — Extrato de Vínculos e Contribuições
// ─────────────────────────────────────────────────────────

export type VinculoCnis = {
  sequencial?: number
  origem: string
  dataInicio?: string
  dataFim?: string
  /** Ex.: "IEAN", "PREC-MENOR-MIN" — relevantes para o cálculo. */
  indicadores: string[]
}

export type CnisResultado = {
  cpfMascarado?: string
  dataNascimento?: string
  vinculos: VinculoCnis[]
  /** Competências com remuneração, "AAAA-MM" → valor. */
  remuneracoes: { competencia: string; valor: number }[]
  /** Soma de meses cobertos pelos vínculos com início e fim conhecidos. */
  mesesVinculo: number
}

function mesesEntre(inicioIso: string, fimIso: string): number {
  const [ai, mi] = inicioIso.split("-").map(Number)
  const [af, mf] = fimIso.split("-").map(Number)
  return Math.max(0, (af - ai) * 12 + (mf - mi) + 1)
}

function extrairCnis(textoBruto: string): Resultado<CnisResultado> {
  const texto = normalizarTexto(textoBruto)

  const cpf = texto.match(/CPF:?\s*([\d.\-]{11,14})/i)?.[1]
  const nascimento = texto.match(
    /Data de [Nn]ascimento:?\s*(\d{2}\/\d{2}\/\d{4})/
  )?.[1]

  // Linhas de vínculo: "1 1234567890 Origem do vínculo 01/03/2005 30/06/2012 IEAN"
  // A origem é texto livre, então ancoramos na data de início. A data
  // de fim é opcional porque vínculo em curso não tem fim — e é
  // justamente o vínculo ativo que mais importa para o requerimento.
  const vinculos: VinculoCnis[] = []
  const linhaVinculo =
    /^(\d{1,3})?\s*(?:[\d.\-/]{10,20}\s+)?(.+?)\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?\s*(.*)$/

  for (const linha of texto.split("\n")) {
    // Cabeçalhos e a seção de remunerações não são vínculos.
    if (/compet[êe]ncia|remunera[çc][ãa]o|seq\b|indicadores/i.test(linha)) continue
    // Campos rotulados do cabeçalho ("CPF: …", "Data de Nascimento: …")
    // também têm data e passariam pelo regex. Linha de vínculo é
    // tabular e não tem rótulo com dois-pontos, o que dá um
    // discriminador confiável.
    if (/^[A-Za-zÀ-ÿ\s.]{3,40}:/.test(linha)) continue
    const m = linha.match(linhaVinculo)
    if (!m) continue
    const origem = m[2].replace(/\s{2,}/g, " ").trim()
    if (origem.length < 3) continue
    vinculos.push({
      sequencial: m[1] ? Number(m[1]) : undefined,
      origem,
      dataInicio: dataBrParaIso(m[3]),
      dataFim: dataBrParaIso(m[4]) ?? undefined,
      indicadores: m[5]
        ? m[5].split(/[\s,;]+/).filter((i) => /^[A-Z][A-Z\-]{2,}$/.test(i))
        : [],
    })
  }

  // Remunerações: "03/2005 1.200,00"
  const remuneracoes: { competencia: string; valor: number }[] = []
  for (const m of texto.matchAll(
    /\b(\d{2})\/(\d{4})\s+((?:\d{1,3}\.)*\d{1,3},\d{2})\b/g
  )) {
    const valor = moedaBrParaNumero(m[3])
    if (valor === undefined) continue
    remuneracoes.push({ competencia: `${m[2]}-${m[1]}`, valor })
  }

  if (vinculos.length === 0 && remuneracoes.length === 0) {
    return { ok: false, motivo: "cnis_sem_dados" }
  }

  const mesesVinculo = vinculos.reduce((total, v) => {
    if (!v.dataInicio || !v.dataFim) return total
    return total + mesesEntre(v.dataInicio, v.dataFim)
  }, 0)

  return {
    ok: true,
    dados: {
      cpfMascarado: cpf ? mascararCpf(cpf) : undefined,
      dataNascimento: dataBrParaIso(nascimento),
      vinculos,
      remuneracoes,
      mesesVinculo,
    },
  }
}

export const adapterCnis: AdapterImportacao<CnisResultado> = {
  fonte: "MEU_INSS",
  modo: "importacao",
  documento: "CNIS",
  reconhece: (texto) =>
    /CNIS|Cadastro Nacional de Informa[çc][õo]es Sociais|Rela[çc][õo]es Previdenci[áa]rias/i.test(
      texto
    ),
  extrair: extrairCnis,
}

// ─────────────────────────────────────────────────────────
// Carta de Concessão
// ─────────────────────────────────────────────────────────

export type ConcessaoResultado = {
  numeroBeneficio?: string
  especie?: string
  /** Data de Início do Benefício. */
  dib?: string
  /** Renda Mensal Inicial. */
  rmi?: number
  cpfMascarado?: string
}

function extrairConcessao(textoBruto: string): Resultado<ConcessaoResultado> {
  const texto = normalizarTexto(textoBruto)

  const nb = texto.match(
    /(?:N[úu]mero do Benef[íi]cio|NB)[:\s]*([\d.\-]{9,15})/i
  )?.[1]
  const especie = texto.match(
    /Esp[ée]cie(?: do benef[íi]cio)?[:\s]*([\d]{2,3}\s*[-–]?\s*[^\n]{0,60})/i
  )?.[1]
  const dib = texto.match(
    /(?:DIB|Data de In[íi]cio do Benef[íi]cio)[:\s]*(\d{2}\/\d{2}\/\d{4})/i
  )?.[1]
  const rmi = texto.match(
    /(?:RMI|Renda Mensal Inicial)[:\s]*R?\$?\s*((?:\d{1,3}\.)*\d{1,3},\d{2})/i
  )?.[1]
  const cpf = texto.match(/CPF:?\s*([\d.\-]{11,14})/i)?.[1]

  if (!nb && !dib) {
    return { ok: false, motivo: "concessao_sem_dados" }
  }

  return {
    ok: true,
    dados: {
      numeroBeneficio: nb ? somenteDigitos(nb) : undefined,
      especie: especie?.replace(/\s{2,}/g, " ").trim(),
      dib: dataBrParaIso(dib),
      rmi: moedaBrParaNumero(rmi),
      cpfMascarado: cpf ? mascararCpf(cpf) : undefined,
    },
  }
}

export const adapterConcessao: AdapterImportacao<ConcessaoResultado> = {
  fonte: "MEU_INSS",
  modo: "importacao",
  documento: "CARTA_CONCESSAO",
  reconhece: (texto) =>
    /Carta de Concess[ãa]o|Mem[óo]ria de C[áa]lculo|Renda Mensal Inicial/i.test(
      texto
    ),
  extrair: extrairConcessao,
}

// ─────────────────────────────────────────────────────────
// Carta de Indeferimento / Comunicado de Decisão
//
// É o documento que dispara prazo: 30 dias para recurso à Junta de
// Recursos, contados da ciência. O parser devolve `prazoRecursoAte`
// já calculado para virar tarefa na agenda.
// ─────────────────────────────────────────────────────────

export type IndeferimentoResultado = {
  protocolo?: string
  servico?: string
  dataRequerimento?: string
  dataDecisao?: string
  motivo?: string
  /** Data-limite para recurso, 30 dias corridos após a decisão. */
  prazoRecursoAte?: string
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function extrairIndeferimento(
  textoBruto: string
): Resultado<IndeferimentoResultado> {
  const texto = normalizarTexto(textoBruto)

  const protocolo = texto.match(/Protocolo[:\s]*([\d.\-/]{6,25})/i)?.[1]
  const servico = texto.match(
    /(?:Servi[çc]o|Benef[íi]cio requerido|Requerimento de)[:\s]*([^\n]{3,80})/i
  )?.[1]
  const dataRequerimento = texto.match(
    /Data (?:do|de) (?:requerimento|entrada)[:\s]*(\d{2}\/\d{2}\/\d{4})/i
  )?.[1]
  const dataDecisao = texto.match(
    /Data (?:da )?(?:decis[ãa]o|conclus[ãa]o|an[áa]lise)[:\s]*(\d{2}\/\d{2}\/\d{4})/i
  )?.[1]
  const motivo = texto.match(
    /(?:Motivo|Fundamenta[çc][ãa]o|Raz[ãa]o do indeferimento)[:\s]*([^\n]{3,200})/i
  )?.[1]

  const indeferido = /indefer/i.test(texto)
  if (!indeferido && !protocolo) {
    return { ok: false, motivo: "indeferimento_sem_dados" }
  }

  const decisaoIso = dataBrParaIso(dataDecisao)

  return {
    ok: true,
    dados: {
      protocolo: protocolo?.trim(),
      servico: servico?.replace(/\s{2,}/g, " ").trim(),
      dataRequerimento: dataBrParaIso(dataRequerimento),
      dataDecisao: decisaoIso,
      motivo: motivo?.replace(/\s{2,}/g, " ").trim(),
      prazoRecursoAte: decisaoIso ? somarDias(decisaoIso, 30) : undefined,
    },
  }
}

export const adapterIndeferimento: AdapterImportacao<IndeferimentoResultado> = {
  fonte: "MEU_INSS",
  modo: "importacao",
  documento: "CARTA_INDEFERIMENTO",
  reconhece: (texto) =>
    /Comunicado de Decis[ãa]o|Carta de Indeferimento|indeferi/i.test(texto),
  extrair: extrairIndeferimento,
}

// ─────────────────────────────────────────────────────────
// Extrato de Pagamento de Benefício
//
// Dados bancários (banco, agência, conta) são descartados: o
// dashboard não precisa deles e guardá-los amplia o dano de um
// vazamento sem nenhum ganho.
// ─────────────────────────────────────────────────────────

export type ExtratoPagamentoResultado = {
  numeroBeneficio?: string
  competencias: { competencia: string; valor: number }[]
  /** Última competência creditada, útil para conferir cessação. */
  ultimaCompetencia?: string
}

function extrairExtratoPagamento(
  textoBruto: string
): Resultado<ExtratoPagamentoResultado> {
  const texto = normalizarTexto(textoBruto)

  const nb = texto.match(
    /(?:N[úu]mero do Benef[íi]cio|Benef[íi]cio|NB)[:\s]*([\d.\-]{9,15})/i
  )?.[1]

  const competencias: { competencia: string; valor: number }[] = []
  for (const m of texto.matchAll(
    /\b(\d{2})\/(\d{4})\b[^\n]*?R?\$?\s*((?:\d{1,3}\.)*\d{1,3},\d{2})/g
  )) {
    const valor = moedaBrParaNumero(m[3])
    if (valor === undefined) continue
    competencias.push({ competencia: `${m[2]}-${m[1]}`, valor })
  }

  if (competencias.length === 0) {
    return { ok: false, motivo: "extrato_sem_competencias" }
  }

  competencias.sort((a, b) => a.competencia.localeCompare(b.competencia))

  return {
    ok: true,
    dados: {
      numeroBeneficio: nb ? somenteDigitos(nb) : undefined,
      competencias,
      ultimaCompetencia: competencias[competencias.length - 1]?.competencia,
    },
  }
}

export const adapterExtratoPagamento: AdapterImportacao<ExtratoPagamentoResultado> =
  {
    fonte: "MEU_INSS",
    modo: "importacao",
    documento: "EXTRATO_PAGAMENTO",
    reconhece: (texto) =>
      /Extrato de Pagamento|Hist[óo]rico de Cr[ée]ditos|Cr[ée]dito de Benef[íi]cio/i.test(
        texto
      ),
    extrair: extrairExtratoPagamento,
  }

export const adaptersMeuInss = [
  adapterCnis,
  adapterConcessao,
  adapterIndeferimento,
  adapterExtratoPagamento,
]
