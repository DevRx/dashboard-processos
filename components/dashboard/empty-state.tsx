import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Tela vazia que ensina o próximo passo.
 *
 * Um "nenhum registro" seco deixa quem chega sem saber se deu erro ou
 * se é só o começo. Aqui cabe o botão que cria o primeiro — a ação
 * está a um clique, onde a dúvida nasceu.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  acao,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  acao?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon size={26} strokeWidth={1.75} />
      </div>
      <p className="font-heading mt-1 text-[15px] font-semibold">{title}</p>
      {description && (
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  )
}
