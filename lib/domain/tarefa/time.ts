// ─────────────────────────────────────────────────────────
// Domínio: times do escritório
//
// O time é identificado pela cor, não pelo nome. Num quadro com
// dezenas de tarefas, a cor responde "de quem é isso?" antes da
// leitura — e é para isso que ela existe aqui.
//
// Os rótulos abaixo são o único lugar a mexer quando os times ganharem
// nomes próprios ("Perícias", "Protocolos"...): o valor gravado no
// banco continua sendo a cor.
//
// A coluna no banco ainda se chama `setor` — `time` é tipo de dado no
// Postgres e viraria uma coluna que só funciona entre aspas. O nome
// que a equipe lê é este daqui.
// ─────────────────────────────────────────────────────────

export const TIMES_TAREFA = [
  "VERMELHO",
  "PRETO",
  "AZUL",
  "AMARELO",
  "VERDE",
] as const

export type TimeTarefa = (typeof TIMES_TAREFA)[number]

export const TIME_LABEL: Record<TimeTarefa, string> = {
  VERMELHO: "Time Vermelho",
  PRETO: "Time Preto",
  AZUL: "Time Azul",
  AMARELO: "Time Amarelo",
  VERDE: "Time Verde",
}

/** Rótulo curto, para caber dentro de um cartão. */
export const TIME_LABEL_CURTO: Record<TimeTarefa, string> = {
  VERMELHO: "Vermelho",
  PRETO: "Preto",
  AZUL: "Azul",
  AMARELO: "Amarelo",
  VERDE: "Verde",
}

export function isTimeTarefa(valor?: string | null): valor is TimeTarefa {
  return TIMES_TAREFA.includes(valor as TimeTarefa)
}
