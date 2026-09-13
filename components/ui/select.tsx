import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { CLASSES_CAMPO } from "@/components/ui/input"

/**
 * Seleção nativa com a mesma roupa do Input.
 *
 * Nativa de propósito: no celular abre a roda do sistema, que qualquer
 * pessoa já sabe usar. A seta é desenhada por nós só para o campo não
 * parecer diferente de um navegador para outro.
 */
function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <span className={cn("relative block w-full", className)}>
      <select
        data-slot="select"
        className={cn(CLASSES_CAMPO, "appearance-none truncate pr-9")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={2}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  )
}

export { Select }
