import {
  Accessibility,
  Baby,
  ClipboardList,
  HeartHandshake,
  Landmark,
  Layers,
  Stethoscope,
  type LucideIcon,
} from "lucide-react"

import type { CategoriaAdministrativo } from "@/lib/domain/beneficio"
import type { SituacaoPericia } from "@/lib/domain/processo"

/**
 * Cor e ícone de cada família de benefício, num lugar só: o cartão do
 * quadro e a página da família precisam ser reconhecíveis como a mesma
 * coisa, e isso só se sustenta se a tinta vier da mesma fonte.
 */
export type Tinta = {
  icone: LucideIcon
  /** Faixa sólida — topo do cartão, cabeçalho da página. */
  barra: string
  /** Fundo suave do ícone. */
  selo: string
  contorno: string
}

export const TINTA: Record<CategoriaAdministrativo, Tinta> = {
  APOSENTADORIA: {
    icone: Landmark,
    barra: "bg-sky-600",
    selo: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
    contorno: "ring-sky-600/25",
  },
  BPC_DEFICIENTE: {
    icone: Accessibility,
    barra: "bg-indigo-600",
    selo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
    contorno: "ring-indigo-600/25",
  },
  AUXILIO_DOENCA: {
    icone: Stethoscope,
    barra: "bg-red-600",
    selo: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    contorno: "ring-red-600/25",
  },
  PENSAO: {
    icone: HeartHandshake,
    barra: "bg-teal-600",
    selo: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
    contorno: "ring-teal-600/25",
  },
  MATERNIDADE: {
    icone: Baby,
    barra: "bg-pink-600",
    selo: "bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300",
    contorno: "ring-pink-600/25",
  },
  PROCEDIMENTO_ADM: {
    icone: ClipboardList,
    barra: "bg-amber-500",
    selo: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    contorno: "ring-amber-500/30",
  },
  OUTROS: {
    icone: Layers,
    barra: "bg-emerald-600",
    selo: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    contorno: "ring-emerald-600/25",
  },
}

/**
 * A mesma identidade, em tinta que o gráfico consegue usar.
 *
 * As classes acima são do Tailwind e não servem para o `fill` de um
 * SVG, então a cor vira variável CSS — e vira uma só, aqui, pelo mesmo
 * motivo que a `TINTA` existe: fatia e cartão precisam ser a mesma
 * coisa aos olhos de quem lê.
 *
 * O degrau não é sempre o mesmo da classe. Lado a lado num gráfico as
 * cores se comparam entre si, o que os cartões nunca fazem — e nesse
 * regime `teal-600` e `emerald-600` eram literalmente a mesma fatia
 * verde (ΔE 5,2 para visão normal, onde o piso é 15). Os degraus foram
 * escolhidos por busca sobre as rampas do Tailwind, validados com o
 * script de paleta do guia de dataviz: no modo claro o conjunto passa
 * em todos os testes (pior par ΔE 8,7 em daltonismo, 17,6 em visão
 * normal, com sete fatias na tela).
 *
 * No escuro a banda de luminosidade util e estreita (L 0,48–0,67) e
 * sete matizes não cabem nela com folga: o melhor alcançável é ΔE 13,7,
 * abaixo do piso. Por isso o gráfico nunca entrega identidade só pela
 * cor — toda fatia carrega rótulo e a legenda repete nome e contagem.
 */
export const COR_CATEGORIA: Record<CategoriaAdministrativo, string> = {
  APOSENTADORIA: "var(--cat-aposentadoria)",
  BPC_DEFICIENTE: "var(--cat-bpc-deficiente)",
  AUXILIO_DOENCA: "var(--cat-auxilio-doenca)",
  PENSAO: "var(--cat-pensao)",
  MATERNIDADE: "var(--cat-maternidade)",
  PROCEDIMENTO_ADM: "var(--cat-procedimento-adm)",
  OUTROS: "var(--cat-outros)",
}

/**
 * Cores das etiquetas de perícia. Vivem aqui porque aparecem em três
 * lugares — o cartão do quadro, a linha do cliente e o menu de troca —
 * e precisam ser a mesma cor nos três.
 */
export const TOM_PERICIA: Record<SituacaoPericia, string> = {
  MARCAR_PERICIA:
    "bg-red-100 text-red-800 ring-red-300 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-800",
  PERICIA_MARCADA:
    "bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-800",
  PRORROGACAO:
    "bg-violet-100 text-violet-800 ring-violet-300 dark:bg-violet-950/60 dark:text-violet-200 dark:ring-violet-800",
}

/** Tons dos estados de processo, para os mesmos chips de contagem. */
export const TOM_STATUS: Record<string, string> = {
  EM_ANALISE: "bg-status-info text-status-info-foreground ring-status-info",
  AGUARDANDO_INSS: "bg-status-info text-status-info-foreground ring-status-info",
  PERICIA_MARCADA: "bg-status-info text-status-info-foreground ring-status-info",
  PERICIA_CONCLUIDA: "bg-status-info text-status-info-foreground ring-status-info",
  BENEFICIO_CONCEDIDO:
    "bg-status-success text-status-success-foreground ring-status-success",
  RECUSADO: "bg-status-danger text-status-danger-foreground ring-status-danger",
  SEM_PROCESSO: "bg-status-muted text-status-muted-foreground ring-status-muted",
}
