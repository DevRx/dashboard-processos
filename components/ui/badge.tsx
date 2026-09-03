import * as React from "react"

import { cn } from "@/lib/utils"

type Variant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"

const VARIANTS: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-status-danger text-status-danger-foreground",
  outline: "bg-card text-foreground ring-1 ring-inset ring-border",
  ghost: "bg-transparent text-muted-foreground",
  link: "bg-transparent p-0 text-primary underline underline-offset-4",
}

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap tabular-nums",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
