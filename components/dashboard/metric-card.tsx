import Link from "next/link"
import { ArrowRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** `atraso` é laranja: vermelho e amarelo são cores de time. */
export type TomMetrica = "neutro" | "info" | "sucesso" | "alerta" | "perigo" | "marca" | "atraso"

const SELO: Record<TomMetrica, string> = {
  neutro: "bg-accent text-accent-foreground",
  info: "bg-status-info text-status-info-foreground",
  sucesso: "bg-status-success text-status-success-foreground",
  alerta: "bg-status-warning text-status-warning-foreground",
  perigo: "bg-status-danger text-status-danger-foreground",
  marca: "bg-brand-soft text-brand",
  atraso: "bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300",
}

const VALOR: Record<TomMetrica, string> = {
  neutro: "",
  info: "",
  sucesso: "text-status-success-foreground",
  alerta: "text-status-warning-foreground",
  perigo: "text-status-danger-foreground",
  marca: "",
  atraso: "text-orange-700 dark:text-orange-400",
}

interface MetricCardProps {
  title: string
  value: string
  description: string
  icon?: LucideIcon
  /** Cor do selo do ícone — e do número, quando o tom é de estado. */
  tom?: TomMetrica
  /** Com `href` o cartão inteiro vira link e ganha "ver" no rodapé. */
  href?: string
  rotuloLink?: string
  className?: string
}

/**
 * Um número grande, com nome e ícone.
 *
 * O ícone é colorido pelo que o número significa: verde para dinheiro
 * que entra, vermelho para prazo estourado. Quem não lê o rótulo ainda
 * entende a cor.
 */
export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tom = "neutro",
  href,
  rotuloLink = "Ver todos",
  className,
}: MetricCardProps) {
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase sm:text-[11.5px]">
            {title}
          </p>

          <p
            className={cn(
              "font-heading mt-2 truncate text-[28px] leading-none font-semibold tracking-tight tabular-nums sm:mt-2.5 sm:text-[34px]",
              VALOR[tom]
            )}
          >
            {value}
          </p>

          {/* No celular os cartões vêm dois por linha: a frase explicativa
              sai, o número e o nome bastam. */}
          <p className="mt-2 hidden text-[12.5px] text-muted-foreground sm:block">{description}</p>
        </div>

        {Icon ? (
          <span
            aria-hidden
            className={cn(
              "hidden size-11 shrink-0 items-center justify-center rounded-xl sm:flex",
              SELO[tom]
            )}
          >
            <Icon size={21} strokeWidth={1.9} />
          </span>
        ) : null}
      </div>

      {href && (
        <span className="mt-3 hidden items-center gap-1 text-[12.5px] font-medium sm:inline-flex text-primary transition-transform duration-150 group-hover:translate-x-0.5 dark:text-accent-foreground">
          {rotuloLink}
          <ArrowRight size={14} strokeWidth={2} />
        </span>
      )}
    </>
  )

  const classes = cn(
    "group flex flex-col rounded-2xl bg-card p-4 text-card-foreground shadow-card transition-all duration-200 sm:p-5",
    href && "outline-none hover:-translate-y-0.5 hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring",
    className
  )

  if (href) {
    return (
      <Link href={href} className={classes}>
        {conteudo}
      </Link>
    )
  }

  return <div className={classes}>{conteudo}</div>
}
