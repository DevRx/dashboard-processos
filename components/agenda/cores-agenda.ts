import type { CategoriaAgenda } from "@/lib/domain/tarefa"

/**
 * As cores do calendário de perícias e prazos.
 *
 * Escolhidas pelo escritório: perícia em branco, prazo em cinza-escuro
 * e exigência em verde. O branco leva contorno — sem ele, a etiqueta
 * some no fundo branco do dia.
 */
export const CORES_CATEGORIA: Record<
  CategoriaAgenda,
  { etiqueta: string; ponto: string; faixa: string }
> = {
  PERICIA: {
    etiqueta:
      "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-300 dark:ring-zinc-400",
    ponto: "bg-white ring-1 ring-zinc-400",
    faixa: "border-l-zinc-300 dark:border-l-white",
  },
  PRAZO: {
    etiqueta: "bg-zinc-700 text-white dark:bg-zinc-600",
    ponto: "bg-zinc-700 dark:bg-zinc-500",
    faixa: "border-l-zinc-700 dark:border-l-zinc-500",
  },
  EXIGENCIA: {
    etiqueta: "bg-emerald-600 text-white",
    ponto: "bg-emerald-600",
    faixa: "border-l-emerald-600",
  },
}
