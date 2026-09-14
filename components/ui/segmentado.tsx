"use client"

import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type OpcaoSegmentada<T extends string> = {
  valor: T
  rotulo: string
  icone?: LucideIcon
  /** Cor da opção quando escolhida — para "Entrada / Saída", "Sim / Não". */
  tom?: "padrao" | "sucesso" | "perigo" | "info" | "alerta"
}

const TOM_ATIVO: Record<NonNullable<OpcaoSegmentada<string>["tom"]>, string> = {
  padrao: "bg-card text-foreground shadow-sm shadow-card",
  sucesso:
    "bg-status-success text-status-success-foreground shadow-sm ring-1 ring-status-success-foreground/20",
  perigo:
    "bg-status-danger text-status-danger-foreground shadow-sm ring-1 ring-status-danger-foreground/20",
  info: "bg-status-info text-status-info-foreground shadow-sm ring-1 ring-status-info-foreground/20",
  alerta:
    "bg-status-warning text-status-warning-foreground shadow-sm ring-1 ring-status-warning-foreground/20",
}

/**
 * Escolha entre poucas opções, todas à vista.
 *
 * Um `<select>` esconde as alternativas atrás de um clique; aqui elas
 * ficam lado a lado e a escolhida acende. Para duas ou três opções é
 * o controle mais fácil de entender — e de acertar no toque.
 */
export function Segmentado<T extends string>({
  valor,
  opcoes,
  onChange,
  tamanho = "md",
  cheio,
  className,
  "aria-label": ariaLabel,
}: {
  valor: T
  opcoes: OpcaoSegmentada<T>[]
  onChange: (valor: T) => void
  tamanho?: "sm" | "md" | "lg"
  /** Ocupa toda a largura, com as opções em partes iguais. */
  cheio?: boolean
  className?: string
  "aria-label"?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-lg bg-muted p-1",
        cheio ? "flex w-full" : "w-fit",
        className
      )}
    >
      {opcoes.map((opcao) => {
        const ativa = opcao.valor === valor
        const Icone = opcao.icone

        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={ativa}
            onClick={() => onChange(opcao.valor)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              tamanho === "sm" && "h-7 px-2.5 text-[12px]",
              tamanho === "md" && "h-8 px-3 text-[12.5px]",
              tamanho === "lg" && "h-10 px-4 text-sm",
              cheio && "flex-1",
              ativa
                ? TOM_ATIVO[opcao.tom ?? "padrao"]
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icone && (
              <Icone
                size={tamanho === "lg" ? 16 : 14}
                strokeWidth={2}
                className="shrink-0"
              />
            )}
            {opcao.rotulo}
          </button>
        )
      })}
    </div>
  )
}
