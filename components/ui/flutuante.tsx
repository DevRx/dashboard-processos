"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

/**
 * Painel que abre colado num botão e fica por cima de tudo.
 *
 * Posição fixa calculada pelo botão, e não `absolute` dentro do cartão:
 * as colunas do kanban rolam por dentro, e um menu absoluto ali dentro
 * seria cortado pela borda da coluna. Fecha no Esc, no clique fora e
 * quando a tela rola — o botão saiu do lugar, o menu não deve ficar
 * flutuando sozinho.
 */
export function Flutuante({
  ancora,
  aberto,
  onFechar,
  largura = 272,
  rotulo,
  className,
  children,
}: {
  ancora: React.RefObject<HTMLElement | null>
  aberto: boolean
  onFechar: () => void
  largura?: number
  rotulo: string
  className?: string
  children: React.ReactNode
}) {
  const painel = useRef<HTMLDivElement>(null)

  // A posição vai direto no estilo do painel, antes de pintar: o painel
  // nasce invisível e aparece já no lugar, sem um quadro fora do lugar.
  useLayoutEffect(() => {
    const el = painel.current
    if (!aberto || !ancora.current || !el) return
    const r = ancora.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const abaixo = vh - r.bottom - 12
    const acima = r.top - 12
    const embaixo = abaixo >= 260 || abaixo >= acima
    el.style.left = `${Math.min(Math.max(8, r.right - largura), vw - largura - 8)}px`
    el.style.top = `${embaixo ? r.bottom + 6 : Math.max(8, r.top - 6 - Math.min(acima, 420))}px`
    el.style.maxHeight = `${Math.min(420, embaixo ? abaixo : acima)}px`
    el.style.visibility = "visible"
  }, [aberto, ancora, largura])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent | TouchEvent) => {
      const alvo = e.target as Node
      if (painel.current?.contains(alvo) || ancora.current?.contains(alvo)) return
      onFechar()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onFechar()
        ancora.current?.focus()
      }
    }
    const rolou = (e: Event) => {
      if (painel.current?.contains(e.target as Node)) return
      onFechar()
    }
    document.addEventListener("mousedown", fora)
    document.addEventListener("touchstart", fora)
    document.addEventListener("keydown", tecla)
    window.addEventListener("scroll", rolou, true)
    window.addEventListener("resize", onFechar)
    return () => {
      document.removeEventListener("mousedown", fora)
      document.removeEventListener("touchstart", fora)
      document.removeEventListener("keydown", tecla)
      window.removeEventListener("scroll", rolou, true)
      window.removeEventListener("resize", onFechar)
    }
  }, [aberto, ancora, onFechar])

  if (!aberto || typeof document === "undefined") return null

  return createPortal(
    <div
      ref={painel}
      role="dialog"
      aria-label={rotulo}
      style={{ top: 0, left: 0, width: largura, visibility: "hidden" }}
      className={cn(
        "animate-in fade-in zoom-in-95 fixed z-[70] overflow-y-auto rounded-xl bg-popover p-1.5 text-popover-foreground shadow-float ring-1 ring-foreground/10 duration-100 motion-reduce:animate-none",
        className
      )}
    >
      {children}
    </div>,
    document.body
  )
}
