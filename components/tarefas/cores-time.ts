import { isTimeAntigo, isTimeTarefa, type CorGravada, type TimeTarefa } from "@/lib/domain/tarefa"

/**
 * A paleta dos times, num lugar só.
 *
 * O quadro de tarefas, o cartão de intimação e a agenda pintam o time
 * com as mesmas classes: se cada tela escolhesse o seu tom de rosa, a
 * cor deixaria de ser o índice que ela é.
 *
 * Fortes de propósito. O cabeçalho do time é cor chapada; o cartão da
 * tarefa leva a mesma cor numa faixa à esquerda e num fundo claro, para
 * que uma tarefa solta na tela continue dizendo de que time é.
 */
export type PaletaTime = {
  /** Cabeçalho do time: fundo chapado e texto legível sobre ele. */
  cabecalho: string
  /** Bolinha de legenda, chip e ponto no calendário. */
  ponto: string
  /** Fundo claro do cartão da tarefa. */
  cartao: string
  /** Faixa à esquerda do cartão (usar junto de `border-l-4`). */
  borda: string
  /** Texto na cor do time, sobre fundo claro. */
  texto: string
}

export const CORES_TIME: Record<CorGravada, PaletaTime> = {
  VERMELHO: {
    cabecalho: "bg-red-600 text-white",
    ponto: "bg-red-600",
    cartao: "bg-red-50 dark:bg-red-950/45",
    borda: "border-l-red-600",
    texto: "text-red-700 dark:text-red-300",
  },
  AZUL: {
    cabecalho: "bg-blue-600 text-white",
    ponto: "bg-blue-600",
    cartao: "bg-blue-50 dark:bg-blue-950/45",
    borda: "border-l-blue-600",
    texto: "text-blue-700 dark:text-blue-300",
  },
  AMARELO: {
    cabecalho: "bg-amber-400 text-amber-950",
    ponto: "bg-amber-400",
    cartao: "bg-amber-50 dark:bg-amber-950/45",
    borda: "border-l-amber-400",
    texto: "text-amber-700 dark:text-amber-300",
  },
  ROSA: {
    cabecalho: "bg-pink-500 text-white",
    ponto: "bg-pink-500",
    cartao: "bg-pink-50 dark:bg-pink-950/45",
    borda: "border-l-pink-500",
    texto: "text-pink-700 dark:text-pink-300",
  },
  // Cores antigas: só para a tarefa que ainda está gravada com elas.
  PRETO: {
    cabecalho: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
    ponto: "bg-zinc-900 dark:bg-zinc-100",
    cartao: "bg-zinc-100 dark:bg-zinc-800/60",
    borda: "border-l-zinc-900 dark:border-l-zinc-100",
    texto: "text-zinc-900 dark:text-zinc-100",
  },
  VERDE: {
    cabecalho: "bg-emerald-600 text-white",
    ponto: "bg-emerald-600",
    cartao: "bg-emerald-50 dark:bg-emerald-950/45",
    borda: "border-l-emerald-600",
    texto: "text-emerald-700 dark:text-emerald-300",
  },
}

/** A paleta da cor gravada na tarefa, ou nada se ela não tem time. */
export function paletaDe(setor?: string | null): PaletaTime | null {
  if (isTimeTarefa(setor) || isTimeAntigo(setor)) return CORES_TIME[setor]
  return null
}

/**
 * As cores dos times no menu lateral, que é escuro o tempo todo: um tom
 * acima do quadro (500 em vez de 600) para a cor acender sobre o
 * azul-noite sem perder o nome do time.
 */
export type PaletaMenu = {
  /** Quadradinho do time, ao lado do nome. */
  amostra: string
  /** Fundo da linha do time quando se está dentro dele. */
  tinta: string
  /** Traço à esquerda das etapas, que liga as etapas ao time. */
  trilho: string
  /** Barra da borda e bolinha da etapa aberta. */
  barra: string
}

export const MENU_TIME: Record<TimeTarefa, PaletaMenu> = {
  VERMELHO: {
    amostra: "bg-red-500 shadow-[0_0_14px_-2px_rgba(239,68,68,0.75)]",
    tinta: "bg-red-500/[0.14]",
    trilho: "border-red-500/45",
    barra: "bg-red-500",
  },
  AZUL: {
    amostra: "bg-blue-500 shadow-[0_0_14px_-2px_rgba(59,130,246,0.8)]",
    tinta: "bg-blue-500/[0.16]",
    trilho: "border-blue-500/50",
    barra: "bg-blue-500",
  },
  AMARELO: {
    amostra: "bg-amber-400 shadow-[0_0_14px_-2px_rgba(251,191,36,0.7)]",
    tinta: "bg-amber-400/[0.13]",
    trilho: "border-amber-400/45",
    barra: "bg-amber-400",
  },
  ROSA: {
    amostra: "bg-pink-500 shadow-[0_0_14px_-2px_rgba(236,72,153,0.75)]",
    tinta: "bg-pink-500/[0.15]",
    trilho: "border-pink-500/45",
    barra: "bg-pink-500",
  },
}
