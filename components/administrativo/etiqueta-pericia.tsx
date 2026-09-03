"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

import { TOM_PERICIA } from "./paleta"
import {
  PERICIA_LABEL,
  SITUACOES_PERICIA,
  isSituacaoPericia,
  periciaSugerida,
  type SituacaoPericia,
} from "@/lib/domain/processo"

/**
 * No auxílio-doença a etiqueta é a informação principal da linha, não
 * um detalhe da ficha — por isso ela é também o controle: clicar na
 * etiqueta troca a etiqueta, sem abrir o cliente.
 */

export function EtiquetaPericia({
  valor,
  status,
  editavel,
  onTrocar,
}: {
  valor: string | null
  status: string | null
  editavel: boolean
  onTrocar: (situacao: SituacaoPericia) => Promise<void>
}) {
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return

    const aoClicar = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setAberto(false)
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false)
    }

    document.addEventListener("mousedown", aoClicar)
    document.addEventListener("keydown", aoTeclar)
    return () => {
      document.removeEventListener("mousedown", aoClicar)
      document.removeEventListener("keydown", aoTeclar)
    }
  }, [aberto])

  // Sem etiqueta gravada, a sugestão vinda do status é melhor que um
  // vazio: a fila existe para dizer qual é a próxima ação.
  const atual: SituacaoPericia = isSituacaoPericia(valor)
    ? valor
    : periciaSugerida(status ?? "")
  const deduzida = !isSituacaoPericia(valor)

  const selo = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] leading-none font-bold tracking-wide uppercase ring-1 ring-inset",
        TOM_PERICIA[atual],
        deduzida && "opacity-75"
      )}
    >
      {salvando ? <Loader2 size={12} className="animate-spin" /> : null}
      {PERICIA_LABEL[atual]}
      {editavel ? <ChevronDown size={12} strokeWidth={2.5} /> : null}
    </span>
  )

  if (!editavel) return selo

  async function escolher(situacao: SituacaoPericia) {
    setAberto(false)
    setSalvando(true)
    try {
      await onTrocar(situacao)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setAberto((v) => !v)
        }}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={
          deduzida
            ? "Etiqueta sugerida pelo status — clique para confirmar ou trocar"
            : "Trocar situação da perícia"
        }
        className="outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 rounded-md"
      >
        {selo}
      </button>

      {aberto && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="animate-in fade-in slide-in-from-top-1 absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-xl bg-popover p-1.5 text-popover-foreground shadow-float duration-150"
        >
          {SITUACOES_PERICIA.map((situacao) => (
            <button
              key={situacao}
              type="button"
              role="menuitem"
              onClick={() => escolher(situacao)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  situacao === "MARCAR_PERICIA" && "bg-red-500",
                  situacao === "PERICIA_MARCADA" && "bg-blue-500",
                  situacao === "PRORROGACAO" && "bg-violet-500"
                )}
              />
              <span className="flex-1">{PERICIA_LABEL[situacao]}</span>
              {situacao === atual && !deduzida ? (
                <Check size={14} strokeWidth={2.5} />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
