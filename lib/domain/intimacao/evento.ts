// ─────────────────────────────────────────────────────────
// Domínio: o evento marcado numa intimação
//
// Perícia e audiência não têm prazo — têm dia e hora. A leitura por
// prazo (lib/integracoes/djen.ts) não as vê: "fica designada perícia
// para o dia 22/10/2026, às 14h, na Central de Perícias" não traz
// "15 dias" em lugar nenhum e, até aqui, virava só um registro.
//
// Esta leitura procura, no texto, uma data perto de uma palavra de
// evento (perícia, audiência, exame, avaliação) e, logo depois dela,
// uma hora e um lugar. Ela é a rede de segurança: a triagem por IA
// (lib/ia/analista-intimacao.ts) lê o mesmo evento com mais contexto,
// e as duas se completam — a IA preenche o local quando a regra não
// acha, a regra garante a data quando a IA não roda.
//
// O que sai daqui vira duas coisas no fluxo (lib/intimacoes/
// gerar-tarefas.ts): a tarefa do evento, no dia e na hora dele, e a
// tarefa de avisar o cliente, na véspera, já com a mensagem pronta.
// ─────────────────────────────────────────────────────────

export const TIPOS_EVENTO = ["PERICIA", "AUDIENCIA", "OUTRO"] as const
export type TipoEvento = (typeof TIPOS_EVENTO)[number]

export const TIPO_EVENTO_LABEL: Record<TipoEvento, string> = {
  PERICIA: "Perícia",
  AUDIENCIA: "Audiência",
  OUTRO: "Compromisso",
}

export type EventoIntimacao = {
  tipo: TipoEvento
  /** AAAA-MM-DD */
  data: string
  /** HH:MM, quando o texto diz. */
  hora: string | null
  local: string | null
  /** Trecho do diário de onde a data saiu, para conferência. */
  trecho: string
}

export function isTipoEvento(valor?: string | null): valor is TipoEvento {
  return TIPOS_EVENTO.includes(valor as TipoEvento)
}

/** Sem acento e em caixa baixa, espaços colapsados. */
function normalizar(texto: string) {
  return (
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      // "Dr.", "Dra.", "Av.", "n.", "art." não encerram a frase: o ponto
      // deles enganaria a janela de busca, que para no fim da frase.
      .replace(/\b(dr|dra|av|n|no|art|arts|sr|sra|fl|fls)\.(?=\s)/g, "$1")
  )
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}

/** "22/10/2026", "22.10.26", "22 de outubro de 2026" → AAAA-MM-DD, ou null. */
function dataIso(d: string, m: string, a: string): string | null {
  const dia = Number(d)
  const mes = /^\d+$/.test(m) ? Number(m) : MESES[m]
  let ano = Number(a)
  if (!dia || !mes || !ano) return null
  if (a.length === 2) ano += 2000
  if (dia > 31 || mes > 12 || ano < 2000 || ano > 2100) return null
  const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
  // 31/02 não existe: o Date corrige para março, e a comparação pega.
  return new Date(`${iso}T12:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null
}

const DATA_NUMERICA = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})/
const DATA_EXTENSO = /(\d{1,2})\s*de\s*(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*de\s*(\d{4})/
/** "às 14h", "as 14:30", "às 9h30min", "14h00". */
const HORA = /(?:as|às)?\s*(\d{1,2})\s*(?:h|:|horas?)\s*(\d{2})?\s*(?:min)?/

function tipoDaPalavra(p: string): TipoEvento {
  if (/pericia|exame|avaliacao/.test(p)) return "PERICIA"
  if (/audiencia/.test(p)) return "AUDIENCIA"
  return "OUTRO"
}

/**
 * Lê o evento designado no texto da intimação — ou `null` quando o
 * texto não marca dia nenhum.
 *
 * A data só vale se estiver perto de uma palavra de evento: numa
 * sentença, as datas de DER, DIB e cessação aparecem às dezenas, e
 * nenhuma delas é compromisso. A hora e o local são lidos depois da
 * data, na mesma frase.
 */
export function extrairEvento(texto: string): EventoIntimacao | null {
  if (!texto?.trim()) return null
  const t = normalizar(texto)

  // Palavra de evento + até ~160 letras + data. A janela curta evita
  // casar "perícia" de um parágrafo com a data do parágrafo seguinte.
  const padrao = new RegExp(
    `(pericia|audiencia|exame medico|avaliacao social|avaliacao medica)[^.;]{0,160}?(?:${DATA_NUMERICA.source}|${DATA_EXTENSO.source})`,
    "g"
  )

  for (const achado of t.matchAll(padrao)) {
    const [bruto, palavra, d1, m1, a1, d2, m2, a2] = achado
    const data = d1 ? dataIso(d1, m1, a1) : dataIso(d2, m2, a2)
    if (!data) continue

    // Datas de outra natureza perto da palavra: "perícia realizada em
    // 10/03/2025" é passado, não compromisso; "laudo da perícia de
    // 12/01/2026" idem. A palavra que antecede a data decide.
    const antesDaData = bruto.slice(palavra.length).replace(/\d.*$/, "")
    if (/(?<!a ser |sera |será )realizad|ocorrid|juntad|laudo|datad|protocolad/.test(antesDaData)) continue

    const inicio = achado.index ?? 0
    const depois = t.slice(inicio + bruto.length, inicio + bruto.length + 220)

    // Hora: só na sequência imediata da data, antes de outro ponto.
    const trechoHora = depois.split(/[.;]/)[0]
    const h = trechoHora.match(HORA)
    const hora =
      h && Number(h[1]) <= 23
        ? `${String(Number(h[1])).padStart(2, "0")}:${h[2] ?? "00"}`
        : null

    // Local: "na Central de Perícias", "no Fórum", "em ...", até a vírgula
    // ou o ponto. Lido do texto original para manter caixa e acento.
    const original = texto.replace(/\s+/g, " ")
    const posOriginal = posicaoNoOriginal(texto, inicio + bruto.length)
    const depoisOriginal = original.slice(posOriginal, posOriginal + 260)
    const l = depoisOriginal.match(
      /\b(?:na|no|em|junto [àa]o?|nas dependencias d[ao]|nas dependências d[ao])\s+((?:Central|Centro|Fórum|Forum|Sala|Juizado|Vara|Clínica|Clinica|Consultório|Consultorio|Hospital|Posto|Agência|Agencia|sede|Rua|Av\.?|Avenida|Quadra|SGAN|SGAS|SCS|SHIS|Setor)[^,.;]{3,120})/i
    )
    const local = l ? l[1].trim() : null

    const fimTrecho = Math.min(texto.length, posOriginal + 90)
    const iniTrecho = Math.max(0, posicaoNoOriginal(texto, inicio) - 10)

    return {
      tipo: tipoDaPalavra(palavra),
      data,
      hora,
      local,
      trecho: `…${original.slice(iniTrecho, fimTrecho).trim()}…`,
    }
  }

  return null
}

/**
 * A normalização tira acentos (um caractere por acento, sem mudar o
 * comprimento) e colapsa espaços (muda). Para voltar ao texto original
 * basta recolocar os espaços: o índice avança por cada run de espaços.
 */
function posicaoNoOriginal(original: string, posNormalizado: number): number {
  let i = 0
  let n = 0
  const o = original.normalize("NFD").replace(/[̀-ͯ]/g, "")
  while (i < o.length && n < posNormalizado) {
    if (/\s/.test(o[i])) {
      while (i < o.length && /\s/.test(o[i])) i++
      n++
    } else {
      i++
      n++
    }
  }
  return i
}

// ── Véspera e mensagem ────────────────────────────────────

/**
 * O dia útil anterior ao evento — é quando o cliente precisa ser
 * lembrado. Sábado e domingo voltam para a sexta; feriado não entra
 * (o calendário forense mora em lib/domain/prazo e não vale para o
 * cliente ir à perícia).
 */
export function vesperaUtil(dataIso: string): string {
  const d = new Date(`${dataIso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function dataBr(dataIso: string): string {
  const [a, m, d] = dataIso.split("-")
  return `${d}/${m}/${a}`
}

/** "Perícia 22/10 às 14:00 — Central de Perícias" */
export function rotuloDoEvento(e: Pick<EventoIntimacao, "tipo" | "data" | "hora" | "local">): string {
  const [, m, d] = e.data.split("-")
  return [
    `${TIPO_EVENTO_LABEL[e.tipo]} ${d}/${m}${e.hora ? ` às ${e.hora}` : ""}`,
    e.local,
  ]
    .filter(Boolean)
    .join(" — ")
}

/**
 * A mensagem que vai ao cliente, no tom do escritório: curta, direta,
 * sem juridiquês, dizendo o que ele precisa fazer. Quem envia é o
 * escritório — nada aqui diz quem escreveu.
 */
export function mensagemPadraoAoCliente(
  e: Pick<EventoIntimacao, "tipo" | "data" | "hora" | "local">,
  primeiroNome?: string | null
): string {
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}! ` : "Olá! "
  const quando = `${dataBr(e.data)}${e.hora ? `, às ${e.hora}` : ""}`
  const onde = e.local ? `, em ${e.local}` : ""

  if (e.tipo === "PERICIA") {
    return (
      `${saudacao}Saiu a data da sua perícia: *${quando}*${onde}.\n\n` +
      "É muito importante comparecer — a perícia é pessoal e não pode ser feita por outra pessoa. " +
      "Leve documento com foto, todos os seus laudos, exames e receitas (os mais recentes e os antigos) e chegue com uns 30 minutos de antecedência.\n\n" +
      "Qualquer dúvida, é só responder aqui."
    )
  }
  if (e.tipo === "AUDIENCIA") {
    return (
      `${saudacao}Foi marcada a audiência do seu processo: *${quando}*${onde}.\n\n` +
      "Sua presença é necessária. Leve documento com foto e, se tiver testemunhas, avise a gente antes para combinarmos.\n\n" +
      "Qualquer dúvida, é só responder aqui."
    )
  }
  return (
    `${saudacao}Ficou marcado um compromisso do seu processo: *${quando}*${onde}.\n\n` +
    "Leve documento com foto. Qualquer dúvida, é só responder aqui."
  )
}
