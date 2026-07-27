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

/** Partículas de nome que não identificam ninguém sozinhas. */
const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e"])

/**
 * Remove identificadores do titular de um texto vindo de fora.
 *
 * A IA lê um laudo que traz o nome e o CPF impressos no papel. Não dá
 * para apagá-los da foto antes de enviar — achar o nome na imagem
 * exigiria ler a imagem, que é o que se quer evitar. O que dá para
 * garantir é que eles não *voltem* gravados: sem isto, o resumo
 * devolvido pelo modelo criaria uma segunda cópia do nome e do CPF em
 * `documentos.ia_resumo`, num campo que a interface mostra em lista e
 * que o log pode capturar.
 *
 * Sobra em vez de faltar: qualquer parte do nome com 4 letras ou mais
 * é apagada. "Silva" some de uma frase onde não era o titular — troca
 * barata perto de vazar o nome de quem está sendo periciado.
 */
export function removerIdentificadores(
  texto: string,
  titular: { nome?: string | null; cpf?: string | null }
): string {
  let limpo = texto

  const digitos = titular.cpf?.replace(/\D/g, "")
  if (digitos && digitos.length === 11) {
    // Pega o CPF escrito de qualquer jeito: com pontos, com espaços ou
    // corrido — como aparece em carimbo e cabeçalho de laudo.
    const solto = digitos.split("").join("[.\\-\\s]*")
    limpo = limpo.replace(new RegExp(solto, "g"), "[CPF removido]")
  }

  if (titular.nome) {
    const partes = titular.nome
      .trim()
      .split(/\s+/)
      .filter((p) => p.length >= 4 && !PARTICULAS.has(p.toLowerCase()))
      .sort((a, b) => b.length - a.length)

    for (const parte of partes) {
      const escapada = parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      limpo = limpo.replace(
        new RegExp(`\\b${escapada}\\b`, "gi"),
        "[nome removido]"
      )
    }
  }

  return (
    limpo
      // Duas remoções seguidas viram uma só — "[nome removido] [nome
      // removido]" é ruído sem informação.
      .replace(/(\[nome removido\]\s*)+/g, "[nome removido] ")
      // A junção acima deixa espaço antes da pontuação que vinha depois
      // do último nome removido.
      .replace(/\s+([,.;:)])/g, "$1")
      .trim()
  )
}

/**
 * Identificador seguro de titular para log: prefixo do UUID, que
 * localiza o registro no banco sem revelar nada sobre a pessoa.
 */
export function refTitular(clienteId?: string | null): string {
  if (!clienteId) return "cliente:—"
  return `cliente:${clienteId.slice(0, 8)}`
}
