import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Rótulo + controle + dica, sempre nessa ordem.
 *
 * Os formulários antigos só tinham o placeholder — que some assim que
 * a pessoa começa a digitar, e aí ela não sabe mais se aquele campo
 * era o CPF ou o telefone. Para quem não usa sistema todo dia, o nome
 * do campo tem que estar sempre à vista.
 *
 * O `<label>` envolve o controle, então clicar no texto foca o campo
 * sem precisar casar `id`/`htmlFor`. Para um grupo de botões (ver
 * Segmentado) use `grupo`: aí o rótulo é só texto, porque um label em
 * volta de vários botões acionaria o primeiro.
 */
export function Campo({
  rotulo,
  dica,
  erro,
  obrigatorio,
  grupo,
  className,
  children,
}: {
  rotulo: string
  dica?: string
  erro?: string | null
  obrigatorio?: boolean
  grupo?: boolean
  className?: string
  children: React.ReactNode
}) {
  const Envelope = grupo ? "div" : "label"

  return (
    <Envelope
      role={grupo ? "group" : undefined}
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
    >
      <span className="text-[12.5px] leading-none font-medium text-foreground/85">
        {rotulo}
        {obrigatorio && (
          <span aria-hidden className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </span>

      {children}

      {erro ? (
        <span role="alert" className="text-[12px] leading-snug text-destructive">
          {erro}
        </span>
      ) : dica ? (
        <span className="text-[12px] leading-snug text-muted-foreground">
          {dica}
        </span>
      ) : null}
    </Envelope>
  )
}

/** Duas ou três colunas de campos que viram uma só no celular. */
export function LinhaCampos({
  colunas = 2,
  className,
  children,
}: {
  colunas?: 2 | 3
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        colunas === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  )
}
