import * as React from "react"

import { cn } from "@/lib/utils"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "soft"
    | "ghost"
    | "destructive"
    | "link"
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm"
}

/**
 * O botão fala a língua dos tokens: `--primary` para a ação principal,
 * `--accent` para a versão suave, `--destructive` para o que apaga.
 *
 * Antes cada variante trazia a própria cor crua (`bg-slate-100`,
 * `hover:bg-[#be123c]`), e o botão principal ficava rosa ao passar o
 * mouse numa interface toda naval. Agora trocar `--primary` em
 * globals.css muda todos os botões — como a RFC de design pede.
 */
const VARIANTES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  outline:
    "border-input bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/70",
  soft: "border-transparent bg-accent text-accent-foreground hover:bg-accent/70",
  ghost:
    "border-transparent bg-transparent text-foreground/80 hover:bg-accent hover:text-accent-foreground",
  destructive:
    "border-transparent bg-destructive text-white shadow-sm hover:bg-destructive/90",
  link: "h-auto border-transparent bg-transparent p-0 text-primary underline-offset-4 hover:underline",
}

const TAMANHOS: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-9 gap-2 px-3.5 text-sm",
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  lg: "h-11 gap-2 px-5 text-[15px]",
  icon: "size-9",
  "icon-sm": "size-8",
}

function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
        VARIANTES[variant],
        TAMANHOS[size],
        className
      )}
      {...props}
    />
  )
}

export { Button }
