import * as React from "react"

import { cn } from "@/lib/utils"

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"

/**
 * Etiqueta curta. As variantes de estado (`success`, `warning`,
 * `danger`, `info`, `muted`) usam os mesmos tokens do StatusBadge de
 * processo, para "concluído" ter a mesma cor em qualquer tela.
 */
const VARIANTES: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-status-danger text-status-danger-foreground",
  outline: "border-border bg-card text-foreground/80",
  ghost: "border-transparent bg-transparent text-foreground/80",
  link: "border-transparent bg-transparent p-0 text-primary underline",
  success: "border-transparent bg-status-success text-status-success-foreground",
  warning: "border-transparent bg-status-warning text-status-warning-foreground",
  danger: "border-transparent bg-status-danger text-status-danger-foreground",
  info: "border-transparent bg-status-info text-status-info-foreground",
  muted: "border-transparent bg-status-muted text-status-muted-foreground",
}

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
        VARIANTES[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
