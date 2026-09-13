import { cn } from "@/lib/utils"
import { getProcessoStatusLabel, type ProcessoStatus } from "@/lib/domain/processo"

export type TomStatus = "info" | "success" | "warning" | "danger" | "muted"

const TOM_POR_STATUS: Record<ProcessoStatus, TomStatus> = {
  EM_ANALISE: "info",
  AGUARDANDO_INSS: "info",
  PERICIA_MARCADA: "info",
  PERICIA_CONCLUIDA: "info",
  BENEFICIO_CONCEDIDO: "success",
  CONCLUIDO: "success",
  RECUSADO: "danger",
  ARQUIVADO: "muted",
}

const CLASSES_POR_TOM: Record<TomStatus, string> = {
  info: "bg-status-info text-status-info-foreground",
  success: "bg-status-success text-status-success-foreground",
  warning: "bg-status-warning text-status-warning-foreground",
  danger: "bg-status-danger text-status-danger-foreground",
  muted: "bg-status-muted text-status-muted-foreground",
}

/** Cor da faixa lateral de um cartão de processo, no mesmo tom da etiqueta. */
export const FAIXA_POR_TOM: Record<TomStatus, string> = {
  info: "border-l-status-info-foreground",
  success: "border-l-status-success-foreground",
  warning: "border-l-status-warning-foreground",
  danger: "border-l-status-danger-foreground",
  muted: "border-l-status-muted-foreground",
}

export function tomDoStatus(status: ProcessoStatus | string): TomStatus {
  return TOM_POR_STATUS[status as ProcessoStatus] || "muted"
}

export function StatusBadge({
  status,
  className,
}: {
  status: ProcessoStatus | string
  className?: string
}) {
  const tom = tomDoStatus(status)
  const label = getProcessoStatusLabel(status)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        CLASSES_POR_TOM[tom],
        className
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}
