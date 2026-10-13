/**
 * Cores de alerta — laranja, e só laranja.
 *
 * As cores dos times têm prioridade sobre tudo: vermelho, azul, amarelo
 * e rosa dizem "de quem é". Se o atraso também fosse vermelho, uma
 * tarefa atrasada do time azul pareceria do time vermelho. Por isso o
 * aviso de tempo usa uma cor que nenhum time usa:
 *
 *   • atrasada → laranja claro, com o ícone de relógio
 *   • urgente  → laranja forte, chapado
 *   • alta     → laranja só no contorno
 *
 * O laranja forte é o 700 e não o 600: com texto branco, o 600 fica
 * abaixo do contraste mínimo de leitura.
 *
 * Destaque que não é alerta (trecho achado na busca, dúvida) usa
 * violeta — também fora da paleta dos times e da agenda.
 */
export const ALERTA = {
  /** Etiqueta de data vencida. */
  atrasada: "bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300",
  /** Texto corrido que avisa atraso ("atrasada · há 2 dias"). */
  atrasadaTexto: "text-orange-700 dark:text-orange-400",
  /** Etiqueta URGENTE e números de urgência. */
  urgente: "bg-orange-700 text-white",
  /** Etiqueta ALTA: mesma família, mais discreta. */
  alta: "bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-300 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-800",
  /** Selo de ícone em contadores de atraso. */
  selo: "bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300",
} as const

export const DESTAQUE = {
  /** Trecho em que a busca bateu. */
  busca: "bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
  /** Marca de dúvida: ícone e etiqueta. */
  duvidaIcone: "text-violet-600 dark:text-violet-400",
  duvidaEtiqueta: "bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300",
  duvidaCaixa: "bg-violet-50 ring-violet-200 dark:bg-violet-950/40 dark:ring-violet-900",
} as const

/** Classes da etiqueta de prioridade; média e baixa não ganham etiqueta. */
export function etiquetaDePrioridade(prioridade: string): string | null {
  if (prioridade === "URGENTE") return ALERTA.urgente
  if (prioridade === "ALTA") return ALERTA.alta
  return null
}
