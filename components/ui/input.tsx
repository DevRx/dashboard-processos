import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Campo de texto. Mais alto que o padrão (40px) de propósito: é o alvo
 * mais tocado do sistema e boa parte de quem usa não é do ramo — ou
 * está no celular.
 */
export const CLASSES_CAMPO =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(CLASSES_CAMPO, type === "file" && "py-2", className)}
      {...props}
    />
  )
}

export { Input }
