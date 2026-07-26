import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string
  description: string
  icon?: LucideIcon
  className?: string
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("transition-shadow duration-150 hover:shadow-sm", className)}>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {title}
          </p>

          <p className="font-heading mt-3 text-4xl leading-none font-semibold tabular-nums">
            {value}
          </p>

          <p className="mt-2 text-xs text-muted-foreground">{description}</p>
        </div>

        {Icon ? (
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
          >
            <Icon size={18} />
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}
