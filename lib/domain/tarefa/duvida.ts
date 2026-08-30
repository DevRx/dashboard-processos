// ─────────────────────────────────────────────────────────
// Domínio: dúvidas e o histórico da tarefa
//
// Uma dúvida no escritório não é um comentário: é trabalho parado.
// Alguém montou a pasta, esbarrou numa pergunta que não sabe responder,
// e o caso ficou onde estava. Por isso a dúvida é uma tarefa de
// verdade — filha da que a originou —, e não um campo de texto: ela
// entra no quadro, tem responsável, tem prazo, e some de lá quando é
// respondida.
// ─────────────────────────────────────────────────────────

export const TIPOS_TAREFA = ["NORMAL", "DUVIDA"] as const
export type TipoTarefa = (typeof TIPOS_TAREFA)[number]

export function isTipoTarefa(valor?: string | null): valor is TipoTarefa {
  return TIPOS_TAREFA.includes(valor as TipoTarefa)
}

export const EVENTOS_TAREFA = [
  "DUVIDA_ABERTA",
  "DUVIDA_RESPONDIDA",
  "STATUS_ALTERADO",
] as const
export type TipoEventoTarefa = (typeof EVENTOS_TAREFA)[number]

export type EventoTarefa = {
  id: string
  tarefaId: string
  tipo: TipoEventoTarefa
  texto: string | null
  statusDe: string | null
  statusPara: string | null
  criadoEm: string
  autor: { id: string; name: string } | null
  /** Preenchido quando o evento veio de uma dúvida filha, não da própria tarefa. */
  daDuvida?: { id: string; titulo: string } | null
}

/**
 * O verbo de cada evento, na voz de quem lê o histórico depois.
 *
 * Passado e impessoal: "perguntou", não "pergunta". Quem abre esta aba
 * está reconstruindo o que já aconteceu, não acompanhando o que está
 * acontecendo.
 */
export const EVENTO_VERBO: Record<TipoEventoTarefa, string> = {
  DUVIDA_ABERTA: "perguntou",
  DUVIDA_RESPONDIDA: "respondeu",
  STATUS_ALTERADO: "mudou o status",
}

/** Uma dúvida sem resposta é o que segura a tarefa mãe. */
export function duvidaEmAberto(d: {
  resposta?: string | null
  status?: string | null
}) {
  return !d.resposta && d.status !== "CANCELADA"
}
