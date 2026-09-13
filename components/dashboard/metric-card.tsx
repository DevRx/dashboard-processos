import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string
  description: string
  icon?: LucideIcon
  className?: string
  /** Tom do selo do ícone. `brand` reserva o rosa para um destaque só. */
  tom?: "primary" | "brand" | "success" | "warning"
}

const TONS: Record<NonNullable<MetricCardProps["tom"]>, string> = {
  primary: "bg-accent text-accent-foreground",
  brand: "bg-brand-soft text-brand",
  success: "bg-status-success text-status-success-foreground",
  warning: "bg-status-warning text-status-warning-foreground",
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  className,
  tom = "primary",
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-card p-5 text-card-foreground shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float",
        className
      )}
    >
      {/* Brilho discreto no canto, que acende no hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-primary/[0.06] blur-2xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-primary/15"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            {title}
          </p>

          <p className="font-heading mt-3 text-[38px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
            {value}
          </p>

          <p className="mt-2.5 text-[12.5px] text-muted-foreground">
            {description}
          </p>
        </div>

        {Icon ? (
          <span
            aria-hidden
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
              TONS[tom]
            )}
          >
            <Icon size={20} strokeWidth={1.9} />
          </span>
        ) : null}
      </div>
    </div>
  )
}
