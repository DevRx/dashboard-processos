"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  CATEGORIA_DESCRICAO,
  CATEGORIA_LABEL,
  CATEGORIA_SLUG,
  type CategoriaAdministrativo,
} from "@/lib/domain/beneficio"

import { TINTA } from "./paleta"

/**
 * Uma etiqueta e quantos clientes estão nela. No auxílio-doença são as
 * etiquetas de perícia; nas outras famílias, o estado do processo.
 */
export type ChipEtiqueta = {
  rotulo: string
  total: number
  /** Classes de cor já resolvidas — ver TOM_PERICIA e TOM_STATUS. */
  tom: string
}

/**
 * Cartão de uma família no quadro.
 *
 * Ele leva para uma página própria em vez de abrir a lista no lugar: a
 * fila de uma família é trabalho de vários minutos, e fazê-la brotar
 * no meio das outras seis embaralhava o "onde eu estou". As etiquetas
 * ficam no cartão para a contagem não ser a única informação: sem
 * elas, saber que há seis auxílios-doença não diz se algum precisa de
 * perícia hoje.
 */
export function CartaoCategoria({
  categoria,
  total,
  alerta,
  etiquetas = [],
}: {
  categoria: CategoriaAdministrativo
  total: number
  /** Chamada curta de pendência — hoje, perícias a marcar. */
  alerta?: string | null
  etiquetas?: ChipEtiqueta[]
}) {
  const tinta = TINTA[categoria]
  const Icone = tinta.icone

  return (
    <Link
      href={`/inss/${CATEGORIA_SLUG[categoria]}`}
      className={cn(
        "group flex flex-col rounded-xl bg-card ring-1 ring-inset transition-shadow duration-200 outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        tinta.contorno
      )}
    >
      <span aria-hidden className={cn("h-1 w-full shrink-0 rounded-t-xl", tinta.barra)} />

      <span className="flex flex-1 items-center gap-3 px-4 py-3.5">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            tinta.selo
          )}
        >
          <Icone size={20} strokeWidth={1.9} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="font-heading block text-[14.5px] leading-tight font-semibold text-balance">
            {CATEGORIA_LABEL[categoria]}
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-muted-foreground">
            {alerta ?? CATEGORIA_DESCRICAO[categoria]}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end">
          <span className="font-heading text-2xl leading-none font-semibold tabular-nums">
            {total}
          </span>
          <span className="text-[10px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
            {total === 1 ? "cliente" : "clientes"}
          </span>
        </span>

        <ChevronRight
          size={18}
          strokeWidth={2}
          className="shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
        />
      </span>

      {etiquetas.length > 0 && (
        <span className="flex flex-wrap gap-1 border-t border-foreground/5 px-4 py-2.5">
          {etiquetas.map((e) => (
            <span
              key={e.rotulo}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide uppercase ring-1 ring-inset",
                e.tom
              )}
            >
              <span className="tabular-nums">{e.total}</span>
              {e.rotulo}
            </span>
          ))}
        </span>
      )}
    </Link>
  )
}
