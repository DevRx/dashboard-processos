import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 p-10 text-center">
      <div className="relative flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon size={24} strokeWidth={1.8} />
        <span
          aria-hidden
          className="absolute inset-0 -z-10 rounded-2xl bg-primary/10 blur-xl"
        />
      </div>
      <p className="font-heading mt-1 text-[14.5px] font-semibold">{title}</p>
      {description && (
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}
