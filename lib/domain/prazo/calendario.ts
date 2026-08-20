// ─────────────────────────────────────────────────────────
// Domínio: calendário forense
//
// Onde ficam os dias em que prazo processual não corre. Três camadas:
//
// 1. Feriados nacionais de lei (Lei 662/1949 e Lei 10.607/2002) e os
//    móveis derivados da Páscoa, que são feriados forenses na Justiça
//    Federal (Lei 5.010/1966, art. 62) e na maioria dos tribunais.
// 2. Suspensão de prazos de 20/12 a 20/1 (CPC, art. 220).
// 3. FERIADOS_TRIBUNAL — o que é de cada tribunal: aniversário da
//    cidade, padroeiro, suspensão por portaria. É a camada que o
//    escritório preenche; começa vazia porque inventar data de
//    suspensão é pior do que não ter nenhuma.
//
// Enquanto a camada 3 estiver vazia, a conta continua sendo uma
// estimativa — e a tela diz isso.
// ─────────────────────────────────────────────────────────

/**
 * Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). Dele saem
 * carnaval, sexta-feira santa e corpus christi.
 */
function domingoDePascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1

  return new Date(Date.UTC(ano, mes - 1, dia))
}

function iso(data: Date) {
  return data.toISOString().slice(0, 10)
}

function somarDias(data: Date, dias: number) {
  const nova = new Date(data)
  nova.setUTCDate(nova.getUTCDate() + dias)
  return nova
}

/**
 * Suspensões e feriados próprios de cada tribunal, por sigla — a mesma
 * que o DJEN usa ("TJDFT", "TRF1", "TRF3"…).
 *
 * Formato: `"AAAA-MM-DD": "motivo"`. Use a chave `"*"` para o que vale
 * em qualquer tribunal (uma emenda de feriado nacional, por exemplo).
 *
 *   TJDFT: {
 *     "2026-04-21": "Fundação de Brasília",
 *     "2026-11-30": "Dia do Evangélico",
 *   },
 *
 * Intervalos longos de suspensão entram dia a dia, ou use
 * `SUSPENSOES_POR_PERIODO` logo abaixo.
 */
export const FERIADOS_TRIBUNAL: Record<string, Record<string, string>> = {
  // Preencher com a lista do escritório.
}

/**
 * Suspensões que duram vários dias — greve, mutirão, portaria de
 * recesso local. `tribunal: "*"` vale para todos.
 *
 *   { tribunal: "TRF1", de: "2026-10-05", ate: "2026-10-09",
 *     motivo: "Suspensão de expediente — Portaria X" },
 */
export const SUSPENSOES_POR_PERIODO: {
  tribunal: string
  de: string
  ate: string
  motivo: string
}[] = [
  // Preencher com a lista do escritório.
]

/** Feriados nacionais de um ano, incluindo os móveis. */
export function feriadosNacionais(ano: number): Map<string, string> {
  const pascoa = domingoDePascoa(ano)

  const fixos: [string, string][] = [
    [`${ano}-01-01`, "Confraternização Universal"],
    [`${ano}-04-21`, "Tiradentes"],
    [`${ano}-05-01`, "Dia do Trabalho"],
    [`${ano}-09-07`, "Independência"],
    [`${ano}-10-12`, "Nossa Senhora Aparecida"],
    [`${ano}-11-02`, "Finados"],
    [`${ano}-11-15`, "Proclamação da República"],
    [`${ano}-11-20`, "Consciência Negra"],
    [`${ano}-12-25`, "Natal"],
  ]

  const moveis: [string, string][] = [
    [iso(somarDias(pascoa, -48)), "Carnaval"],
    [iso(somarDias(pascoa, -47)), "Carnaval"],
    [iso(somarDias(pascoa, -2)), "Sexta-feira Santa"],
    [iso(somarDias(pascoa, 60)), "Corpus Christi"],
  ]

  return new Map([...fixos, ...moveis])
}

/**
 * Suspensão de prazos processuais entre 20 de dezembro e 20 de
 * janeiro (CPC, art. 220). Vale para todos os tribunais.
 */
function dentroDoRecesso(dataIso: string) {
  const mesDia = dataIso.slice(5)
  return mesDia >= "12-20" || mesDia <= "01-20"
}

export type DiaNaoUtil = { data: string; motivo: string }

/**
 * Por que este dia não conta — `null` quando ele é dia útil normal.
 * `tribunal` é opcional: sem ele, só as regras nacionais entram.
 */
export function motivoDiaNaoUtil(
  dataIso: string,
  tribunal?: string | null
): DiaNaoUtil | null {
  const data = new Date(`${dataIso}T12:00:00Z`)
  const diaSemana = data.getUTCDay()

  if (diaSemana === 0) return { data: dataIso, motivo: "Domingo" }
  if (diaSemana === 6) return { data: dataIso, motivo: "Sábado" }

  const nacional = feriadosNacionais(data.getUTCFullYear()).get(dataIso)
  if (nacional) return { data: dataIso, motivo: nacional }

  if (dentroDoRecesso(dataIso)) {
    return { data: dataIso, motivo: "Suspensão de prazos (CPC, art. 220)" }
  }

  const doTribunal =
    FERIADOS_TRIBUNAL["*"]?.[dataIso] ??
    (tribunal ? FERIADOS_TRIBUNAL[tribunal]?.[dataIso] : undefined)

  if (doTribunal) return { data: dataIso, motivo: doTribunal }

  const suspensao = SUSPENSOES_POR_PERIODO.find(
    (s) =>
      (s.tribunal === "*" || s.tribunal === tribunal) &&
      dataIso >= s.de &&
      dataIso <= s.ate
  )

  if (suspensao) return { data: dataIso, motivo: suspensao.motivo }

  return null
}

export function ehDiaUtil(dataIso: string, tribunal?: string | null) {
  return motivoDiaNaoUtil(dataIso, tribunal) === null
}

/** Próximo dia útil depois de `dataIso`. */
export function proximoDiaUtil(dataIso: string, tribunal?: string | null) {
  let data = new Date(`${dataIso}T12:00:00Z`)

  do {
    data = somarDias(data, 1)
  } while (!ehDiaUtil(iso(data), tribunal))

  return iso(data)
}

/**
 * `true` enquanto o escritório não tiver cadastrado nada próprio —
 * é o que a tela usa para continuar chamando a data de estimativa.
 */
export function calendarioIncompleto() {
  return (
    Object.keys(FERIADOS_TRIBUNAL).length === 0 &&
    SUSPENSOES_POR_PERIODO.length === 0
  )
}
