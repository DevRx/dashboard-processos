/**
 * Mascaramento para log e telemetria.
 *
 * Regra do projeto: dado pessoal não entra em `console.*`. Log fica
 * no servidor, é agregado por provedor terceiro e sobrevive à
 * eliminação pedida pelo titular — ou seja, um CPF logado é um
 * vazamento com prazo indeterminado. Use estas funções em toda
 * mensagem de erro que mencione titular.
 *
 * Não é `server-only`: a UI também mascara antes de exibir CPF em
 * tela compartilhada.
 */

/** "12345678909" → "***.***.789-**" */
export function mascararCpf(cpf?: string | null): string {
  if (!cpf) return "—"
  const d = cpf.replace(/\D/g, "")
  if (d.length !== 11) return "***"
  return `***.***.${d.slice(6, 9)}-**`
}

/** "Maria Aparecida da Silva" → "Maria A. S." */
export function mascararNome(nome?: string | null): string {
  if (!nome) return "—"
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0]
  return [partes[0], ...partes.slice(1).map((p) => `${p[0]}.`)].join(" ")
}

/** "maria@exemplo.com" → "m***@exemplo.com" */
export function mascararEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return "—"
  const [local, dominio] = email.split("@")
  return `${local[0]}***@${dominio}`
}

/** "1234567890" (NB) → "*******890" */
export function mascararBeneficio(nb?: string | null): string {
  if (!nb) return "—"
  const d = nb.replace(/\D/g, "")
  if (d.length < 4) return "***"
  return `${"*".repeat(d.length - 3)}${d.slice(-3)}`
}

/**
 * Identificador seguro de titular para log: prefixo do UUID, que
 * localiza o registro no banco sem revelar nada sobre a pessoa.
 */
export function refTitular(clienteId?: string | null): string {
  if (!clienteId) return "cliente:—"
  return `cliente:${clienteId.slice(0, 8)}`
}
