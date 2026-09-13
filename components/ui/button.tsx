import * as React from "react"

import { cn } from "@/lib/utils"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 outline-none select-none " +
  "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0"

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-primary text-primary-foreground shadow-glow hover:bg-primary-hover",
  outline:
    "border border-input bg-card text-foreground shadow-xs hover:bg-muted hover:border-foreground/20",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/70",
  ghost:
    "text-foreground/80 hover:bg-muted hover:text-foreground",
  destructive:
    "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
  link:
    "h-auto p-0 text-primary underline-offset-4 hover:underline active:scale-100",
}

const SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-9 px-3.5",
  sm: "h-8 px-2.5 text-[12.5px] rounded-md",
  lg: "h-11 px-5 text-[15px] rounded-xl",
  icon: "size-9 p-0",
}

function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button
      data-slot="button"
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  )
}

export { Button }
