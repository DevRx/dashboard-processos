// ─────────────────────────────────────────────────────────
// Domínio: times do escritório
//
// O time é identificado pela cor, e só pela cor. Num quadro com
// dezenas de tarefas, a cor responde "de quem é isso?" antes da
// leitura — e é para isso que ela existe aqui. Nome de pessoa não
// aparece no rótulo do time: quem responde pela tarefa já vem no
// cartão, e gente muda de time sem que o time mude de cor.
//
// São quatro, nesta ordem: vermelho, azul, amarelo e rosa. A ordem do
// array é a ordem em que os times aparecem em todas as telas.
//
// A coluna no banco ainda se chama `setor` — `time` é tipo de dado no
// Postgres e viraria uma coluna que só funciona entre aspas. O nome
// que a equipe lê é este daqui.
// ─────────────────────────────────────────────────────────

export const TIMES_TAREFA = ["VERMELHO", "AZUL", "AMARELO", "ROSA"] as const

export type TimeTarefa = (typeof TIMES_TAREFA)[number]

/**
 * Cores que já foram time e continuam gravadas em tarefas antigas.
 *
 * O enum do banco ainda aceita as duas — remover valor de enum no
 * Postgres exige recriar o tipo, e apagaria a informação de onde a
 * tarefa estava. Na tela elas não são time: aparecem na faixa "a
 * classificar", com a cor antiga, até alguém arrastar para um dos
 * quatro.
 */
export const TIMES_ANTIGOS = ["PRETO", "VERDE"] as const

export type TimeAntigo = (typeof TIMES_ANTIGOS)[number]

/** Qualquer cor que o banco aceita em `tarefas.setor`. */
export type CorGravada = TimeTarefa | TimeAntigo

export const TIME_LABEL: Record<TimeTarefa, string> = {
  VERMELHO: "Vermelho",
  AZUL: "Azul",
  AMARELO: "Amarelo",
  ROSA: "Rosa",
}

/** Rótulo curto, para caber dentro de um cartão. Hoje é o mesmo. */
export const TIME_LABEL_CURTO: Record<TimeTarefa, string> = TIME_LABEL

export const TIME_ANTIGO_LABEL: Record<TimeAntigo, string> = {
  PRETO: "Preto (antigo)",
  VERDE: "Verde (antigo)",
}

export function isTimeTarefa(valor?: string | null): valor is TimeTarefa {
  return TIMES_TAREFA.includes(valor as TimeTarefa)
}

export function isTimeAntigo(valor?: string | null): valor is TimeAntigo {
  return TIMES_ANTIGOS.includes(valor as TimeAntigo)
}

/** O nome da cor gravada, seja ela de time atual ou antigo. */
export function rotuloDaCor(valor?: string | null): string | null {
  if (isTimeTarefa(valor)) return TIME_LABEL[valor]
  if (isTimeAntigo(valor)) return TIME_ANTIGO_LABEL[valor]
  return null
}
