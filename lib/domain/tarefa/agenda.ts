// ─────────────────────────────────────────────────────────
// Domínio: o que vai para o calendário de perícias e prazos
//
// A agenda tem dois calendários. O de cima é o geral: toda tarefa em
// aberto, na cor do time. O de baixo separa o que tem data que não se
// move — e cada tipo ganha a sua cor, porque perder uma perícia e
// perder um prazo são erros diferentes:
//
//   • perícia   → branco        (a data está na própria tarefa)
//   • prazo     → cinza-escuro  (o monitor do DJEN abre a tarefa)
//   • exigência → verde         (exigência do INSS, também com prazo)
//
// Não há campo "tipo" para isso no banco: a classificação sai do que a
// tarefa já carrega — o vínculo com a intimação, a pasta que veio do
// TickTick e o título. Mudar a regra é mexer só aqui.
// ─────────────────────────────────────────────────────────

export const CATEGORIAS_AGENDA = ["PERICIA", "PRAZO", "EXIGENCIA"] as const

export type CategoriaAgenda = (typeof CATEGORIAS_AGENDA)[number]

export const CATEGORIA_AGENDA_LABEL: Record<CategoriaAgenda, string> = {
  PERICIA: "Perícia",
  PRAZO: "Prazo",
  EXIGENCIA: "Exigência",
}

export type TarefaParaAgenda = {
  titulo: string
  pasta?: string | null
  tipo?: string | null
  /** A tarefa nasceu de uma intimação do DJEN. */
  deIntimacao?: boolean
}

/** Sem acento e em caixa alta: "Perícia" e "PERICIA" são a mesma coisa. */
function normalizar(texto?: string | null) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
}

/**
 * Em qual cor do calendário de perícias e prazos a tarefa entra — ou
 * `null`, se ela é só uma tarefa e fica no calendário geral.
 *
 * A ordem das perguntas importa:
 * 1. Veio do DJEN? É prazo, ainda que a intimação fale de perícia — a
 *    data gravada é a do prazo, não a do exame.
 * 2. Fala em exigência? Verde.
 * 3. Fala em perícia? Branco. "Pericial" não conta: "laudo pericial
 *    juntado" é andamento, não dia de perícia.
 * 4. Mora numa pasta de prazo ou de andamento judicial? Prazo — são as
 *    intimações que a rotina "pje" lança no TickTick.
 */
export function categoriaNaAgenda(t: TarefaParaAgenda): CategoriaAgenda | null {
  // Dúvida é conversa interna, não compromisso com data.
  if (t.tipo === "DUVIDA") return null

  if (t.deIntimacao) return "PRAZO"

  const titulo = normalizar(t.titulo)
  const pasta = normalizar(t.pasta)
  const texto = `${titulo} ${pasta}`

  if (/\bEXIGENCIAS?\b/.test(texto)) return "EXIGENCIA"
  if (/\bPERICIAS?\b/.test(texto)) return "PERICIA"
  if (/\bPRAZOS?\b/.test(pasta)) return "PRAZO"
  if (/\bJUDICIAL\b/.test(pasta) && /\bANDAMENTOS?\b/.test(pasta)) return "PRAZO"

  return null
}
