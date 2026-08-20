// ─────────────────────────────────────────────────────────
// Domínio: a tarefa que nasce de uma intimação
//
// Três caminhos criam a mesma tarefa — a busca automática, o botão do
// cartão e o mutirão dos prazos pendentes. Se cada um montasse o
// título do seu jeito, o quadro de tarefas viraria três dialetos.
// ─────────────────────────────────────────────────────────

export type TarefaPrioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"

/**
 * Prazo que corre contra outra parte não é tarefa do escritório.
 *
 * "O INSS implantará o benefício em 60 dias" vira acompanhamento, não
 * um prazo na agenda de quem advoga. Quando a IA identifica isso, a
 * tarefa nasce com prioridade baixa em vez de urgente.
 */
export function prazoEhDoEscritorio(intimacao: IntimacaoParaTarefa): boolean {
  return intimacao.ia_prazo_de_quem !== "OUTRA_PARTE"
}

export type IntimacaoParaTarefa = {
  tipo_documento?: string | null
  tipo_comunicacao?: string | null
  destinatario?: string | null
  numero_processo_mascara?: string | null
  sigla_tribunal?: string | null
  nome_orgao?: string | null
  link?: string | null
  texto?: string | null
  prazo_dias?: number | null
  /** Triagem por IA, quando houver — ver lib/ia/analista-intimacao.ts. */
  ia_tipo_ato?: string | null
  ia_providencia?: string | null
  ia_urgencia?: string | null
  ia_prazo_de_quem?: string | null
}

/** Trecho do diário que cabe na descrição sem virar um documento. */
const LIMITE_DESCRICAO = 1200

/**
 * Prioridade pela distância até o vencimento.
 *
 * Vencendo hoje, amanhã ou já vencido é urgente — e vencido entra
 * urgente de propósito: se passou e ninguém viu, é o primeiro caso a
 * olhar, não o último.
 */
export function prioridadePorPrazo(
  prazoFinal: string,
  hoje = new Date().toISOString().slice(0, 10),
  intimacao?: IntimacaoParaTarefa
): TarefaPrioridade {
  if (intimacao && !prazoEhDoEscritorio(intimacao)) return "BAIXA"

  const dias = Math.round(
    (new Date(`${prazoFinal}T12:00:00Z`).getTime() -
      new Date(`${hoje}T12:00:00Z`).getTime()) /
      86_400_000
  )

  if (dias <= 1) return "URGENTE"
  if (dias <= 3) return "ALTA"
  return "MEDIA"
}

/**
 * O título prefere o que a IA leu: "Emendar a inicial juntando CNIS"
 * diz o que fazer, enquanto "Despacho" só diz o que chegou. Sem
 * triagem, cai no rótulo do diário.
 */
export function tituloDaTarefa(intimacao: IntimacaoParaTarefa): string {
  const acao =
    intimacao.ia_providencia?.trim() ||
    intimacao.ia_tipo_ato?.trim() ||
    intimacao.tipo_documento ||
    intimacao.tipo_comunicacao ||
    "Intimação"

  return [
    acao,
    intimacao.destinatario,
    intimacao.prazo_dias ? `${intimacao.prazo_dias} dias` : null,
  ]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 200)
}

/**
 * O texto do diário vai junto para a tarefa se bastar sozinha: quem
 * abre o quadro de manhã precisa saber o que fazer sem voltar aqui.
 */
export function descricaoDaTarefa(intimacao: IntimacaoParaTarefa): string {
  // A triagem entra no topo: é o que a pessoa lê primeiro na tarefa.
  const triagem = [
    intimacao.ia_tipo_ato ? `Ato: ${intimacao.ia_tipo_ato}` : null,
    intimacao.ia_providencia ? `Providência: ${intimacao.ia_providencia}` : null,
    intimacao.ia_prazo_de_quem === "OUTRA_PARTE"
      ? "Atenção: o prazo do texto é de outra parte."
      : null,
  ]
    .filter(Boolean)
    .join("\n")

  return [
    triagem ? `${triagem}\n` : null,
    intimacao.numero_processo_mascara
      ? `Processo ${intimacao.numero_processo_mascara}`
      : null,
    [intimacao.sigla_tribunal, intimacao.nome_orgao].filter(Boolean).join(" · "),
    intimacao.link,
    "",
    (intimacao.texto ?? "").slice(0, LIMITE_DESCRICAO),
  ]
    .filter((linha) => linha !== null)
    .join("\n")
}
