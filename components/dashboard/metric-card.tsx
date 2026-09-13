import Link from "next/link"
import { ArrowRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type TomMetrica = "neutro" | "info" | "sucesso" | "alerta" | "perigo" | "marca"

const SELO: Record<TomMetrica, string> = {
  neutro: "bg-accent text-accent-foreground",
  info: "bg-status-info text-status-info-foreground",
  sucesso: "bg-status-success text-status-success-foreground",
  alerta: "bg-status-warning text-status-warning-foreground",
  perigo: "bg-status-danger text-status-danger-foreground",
  marca: "bg-brand/10 text-brand",
}

const VALOR: Record<TomMetrica, string> = {
  neutro: "",
  info: "",
  sucesso: "text-status-success-foreground",
  alerta: "text-status-warning-foreground",
  perigo: "text-status-danger-foreground",
  marca: "",
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
          <p className="text-[11.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {title}
          </p>

          <p
            className={cn(
              "font-heading mt-2.5 truncate text-[34px] leading-none font-semibold tracking-tight tabular-nums",
              VALOR[tom]
            )}
          >
            {value}
          </p>

          <p className="mt-2 text-[12.5px] text-muted-foreground">{description}</p>
        </div>

        {Icon ? (
          <span
            aria-hidden
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              SELO[tom]
            )}
          >
            <Icon size={21} strokeWidth={1.9} />
          </span>
        ) : null}
      </div>

      {href && (
        <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary transition-transform duration-150 group-hover:translate-x-0.5 dark:text-accent-foreground">
          {rotuloLink}
          <ArrowRight size={14} strokeWidth={2} />
        </span>
      )}
    </>
  )

  const classes = cn(
    "group flex flex-col rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 transition-shadow duration-150",
    href && "outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
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
