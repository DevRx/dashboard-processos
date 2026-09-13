import { cn } from "@/lib/utils"
import { getProcessoStatusLabel, type ProcessoStatus } from "@/lib/domain/processo"

type Tom = "info" | "success" | "warning" | "danger" | "muted"

const TOM_POR_STATUS: Record<ProcessoStatus, Tom> = {
  EM_ANALISE: "info",
  AGUARDANDO_INSS: "info",
  PERICIA_MARCADA: "info",
  PERICIA_CONCLUIDA: "info",
  BENEFICIO_CONCEDIDO: "success",
  CONCLUIDO: "success",
  RECUSADO: "danger",
  ARQUIVADO: "muted",
}

const CLASSES_POR_TOM: Record<Tom, string> = {
  info: "bg-status-info text-status-info-foreground",
  success: "bg-status-success text-status-success-foreground",
  warning: "bg-status-warning text-status-warning-foreground",
  danger: "bg-status-danger text-status-danger-foreground",
  muted: "bg-status-muted text-status-muted-foreground",
}

export function StatusBadge({
  status,
  className,
}: {
  status: ProcessoStatus | string
  className?: string
}) {
  const tom = TOM_POR_STATUS[status as ProcessoStatus] || "muted"
  const label = getProcessoStatusLabel(status)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap",
        CLASSES_POR_TOM[tom],
        className
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />
      {label}
    </span>
  )
}
