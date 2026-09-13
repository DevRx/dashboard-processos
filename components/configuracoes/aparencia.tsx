"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Check, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"

const OPCOES = [
  { valor: "light", rotulo: "Claro", descricao: "Fundo branco, para ambientes iluminados", icone: Sun },
  { valor: "dark", rotulo: "Escuro", descricao: "Descansa a vista à noite", icone: Moon },
] as const

const semAssinatura = () => () => {}

/**
 * Escolha do tema em dois cartões grandes, com uma miniatura de cada.
 * O tema é lido só depois de montar: no servidor não há como saber a
 * preferência, e o HTML sai com nenhum cartão marcado.
 */
export function EscolhaAparencia() {
  const { resolvedTheme, setTheme } = useTheme()
  const montado = useSyncExternalStore(semAssinatura, () => true, () => false)
  const atual = montado ? resolvedTheme : undefined

  return (
    <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-2">
      {OPCOES.map((o) => {
        const Icone = o.icone
        const ativo = atual === o.valor
        const escuro = o.valor === "dark"

        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => setTheme(o.valor)}
            className={cn(
              "group flex flex-col overflow-hidden rounded-xl text-left ring-1 transition-shadow outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
              ativo ? "ring-2 ring-primary" : "ring-foreground/10"
            )}
          >
            {/* Miniatura: sidebar, cabeçalho e dois cartões. */}
            <span
              aria-hidden
              className={cn(
                "flex h-24 gap-1.5 p-2.5",
                escuro ? "bg-[#0d1117]" : "bg-[#f7f8fa]"
              )}
            >
              <span className={cn("w-8 rounded", escuro ? "bg-[#0b1016]" : "bg-[#131a21]")} />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className={cn("h-3 rounded", escuro ? "bg-[#141a21]" : "bg-white")} />
                <span className="flex flex-1 gap-1.5">
                  <span className={cn("flex-1 rounded", escuro ? "bg-[#141a21]" : "bg-white")} />
                  <span className={cn("flex-1 rounded", escuro ? "bg-[#141a21]" : "bg-white")} />
                </span>
              </span>
            </span>

            <span className="flex items-center gap-3 bg-card px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icone size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{o.rotulo}</span>
                <span className="block text-[12px] text-muted-foreground">{o.descricao}</span>
              </span>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
                  ativo ? "bg-primary text-primary-foreground" : "bg-muted text-transparent"
                )}
              >
                <Check size={14} strokeWidth={3} />
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
