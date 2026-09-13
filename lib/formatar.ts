/**
 * Formatação para a tela, num lugar só.
 *
 * As páginas repetiam `slice(0, 10).split("-").reverse().join("/")` em
 * cada tabela; centralizar aqui é o que permite que a data, o CPF e o
 * telefone apareçam do mesmo jeito em todas as telas — e que quem lê
 * reconheça o dado pelo formato antes de ler o rótulo.
 */

const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
]

/** `2026-09-13T…` → `13/09/2026`. Vazio vira travessão. */
export function formatarData(iso?: string | null, vazio = "—") {
  if (!iso) return vazio
  const [ano, mes, dia] = iso.slice(0, 10).split("-")
  if (!ano || !mes || !dia) return vazio
  return `${dia}/${mes}/${ano}`
}

/** `2026-09-13` → `{ dia: "13", mes: "set", ano: "2026" }` — para blocos de data. */
export function partesData(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-")
  const indice = Number(mes) - 1
  return { dia, mes: MESES_CURTOS[indice] ?? mes, ano }
}

/** `2026-09-13` → `sábado, 13 de setembro de 2026`. */
export function formatarDataLonga(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(data)
}

export function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Dias entre hoje e a data: negativo é passado. */
export function diasAte(iso: string) {
  const hoje = new Date(hojeISO())
  const alvo = new Date(iso.slice(0, 10))
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

/**
 * Data relativa em linguagem de gente: "hoje", "amanhã", "há 3 dias",
 * "em 2 dias". Para quem não é do ramo, "faltam 2 dias" diz mais que
 * "15/09".
 */
export function prazoRelativo(iso: string) {
  const dias = diasAte(iso)
  if (dias === 0) return "hoje"
  if (dias === 1) return "amanhã"
  if (dias === -1) return "ontem"
  if (dias < 0) return `há ${-dias} dias`
  return `em ${dias} dias`
}

export function formatarCPF(cpf?: string | null) {
  if (!cpf) return "—"
  const digitos = cpf.replace(/\D/g, "")
  if (digitos.length !== 11) return cpf
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

export function formatarTelefone(telefone?: string | null) {
  if (!telefone) return "—"
  const digitos = telefone.replace(/\D/g, "")
  if (digitos.length === 11) {
    return digitos.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
  }
  if (digitos.length === 10) {
    return digitos.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
  }
  return telefone
}

export function formatarBRL(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/** Duas letras que representam a pessoa: primeira do primeiro e do último nome. */
export function iniciais(nome?: string | null) {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ""
  return (primeira + ultima).toUpperCase()
}

/** Só o primeiro nome — é como as pessoas se chamam no escritório. */
export function primeiroNome(nome?: string | null) {
  return (nome ?? "").trim().split(/\s+/)[0] ?? ""
}

export function saudacao(agora = new Date()) {
  const hora = agora.getHours()
  if (hora < 12) return "Bom dia"
  if (hora < 18) return "Boa tarde"
  return "Boa noite"
}
