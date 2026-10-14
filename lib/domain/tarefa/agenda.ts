// ─────────────────────────────────────────────────────────
// Domínio: o que vai para o calendário de perícias e prazos
//
// A agenda tem dois calendários. O de cima é o geral: toda tarefa em
// aberto, na cor do time. O de baixo separa o que tem data que não se
// move — e cada tipo ganha a sua cor, porque perder uma perícia e
// perder um prazo são erros diferentes:
//
//   • prazo     → vermelho  (o monitor do DJEN abre a tarefa; vermelho
//                            é a cor do judicial)
//   • perícia   → amarelo   (a data está na própria tarefa)
//   • exigência → verde     (exigência do INSS, diferente das duas)
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
 * 1. Veio do DJEN? É prazo — salvo a perícia que o motor leu da
 *    intimação, gravada na pasta "ANDAMENTOS › PERÍCIA" com a data do
 *    exame: essa é perícia.
 * 2. Fala em exigência? Verde.
 * 3. Fala em perícia? Branco. "Pericial" não conta: "laudo pericial
 *    juntado" é andamento, não dia de perícia.
 * 4. Mora numa pasta de prazo ou de andamento judicial? Prazo — são as
 *    intimações que a rotina "pje" lança no TickTick.
 */
export function categoriaNaAgenda(t: TarefaParaAgenda): CategoriaAgenda | null {
  // Dúvida é conversa interna, não compromisso com data.
  if (t.tipo === "DUVIDA") return null

  const titulo = normalizar(t.titulo)
  const pasta = normalizar(t.pasta)
  const texto = `${titulo} ${pasta}`

  // A perícia lida da intimação (lib/intimacoes/gerar-tarefas.ts) vem
  // com a data do exame, não a de um prazo: é perícia no calendário.
  if (t.deIntimacao) return /\bPERICIAS?\b/.test(pasta) ? "PERICIA" : "PRAZO"

  // "Avisar cliente da perícia" é tarefa sobre a perícia, não a perícia:
  // fica no calendário geral, na véspera, com as outras tarefas.
  if (/^AVISAR\b/.test(titulo)) return null

  if (/\bEXIGENCIAS?\b/.test(texto)) return "EXIGENCIA"
  if (/\bPERICIAS?\b/.test(texto)) return "PERICIA"
  if (/\bPRAZOS?\b/.test(pasta)) return "PRAZO"
  if (/\bJUDICIAL\b/.test(pasta) && /\bANDAMENTOS?\b/.test(pasta)) return "PRAZO"

  return null
}
