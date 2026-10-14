"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Check, Monitor, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"

const OPCOES = [
  { valor: "system", rotulo: "Automático", descricao: "Segue o claro ou escuro do aparelho", icone: Monitor },
  { valor: "light", rotulo: "Claro", descricao: "Fundo branco, para ambientes iluminados", icone: Sun },
  { valor: "dark", rotulo: "Escuro", descricao: "Descansa a vista à noite", icone: Moon },
] as const

const semAssinatura = () => () => {}

/** Miniatura: sidebar, cabeçalho e dois cartões. */
function Miniatura({ escuro, className }: { escuro: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex h-24 gap-1.5 p-2.5", escuro ? "bg-[#0d1117]" : "bg-[#f7f8fa]", className)}
    >
      <span className={cn("w-8 shrink-0 rounded", escuro ? "bg-[#0b1016]" : "bg-[#131a21]")} />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className={cn("h-3 rounded", escuro ? "bg-[#141a21]" : "bg-white")} />
        <span className="flex flex-1 gap-1.5">
          <span className={cn("flex-1 rounded", escuro ? "bg-[#141a21]" : "bg-white")} />
          <span className={cn("flex-1 rounded", escuro ? "bg-[#141a21]" : "bg-white")} />
        </span>
      </span>
    </span>
  )
}

/**
 * Escolha do tema em cartões grandes, com uma miniatura de cada. O
 * padrão é o automático: cada um vê o sistema como o aparelho dele já
 * está — claro de dia, escuro à noite, se assim estiver configurado.
 * O tema é lido só depois de montar: no servidor não há como saber a
 * preferência, e o HTML sai com nenhum cartão marcado.
 */
export function EscolhaAparencia() {
  const { theme, setTheme } = useTheme()
  const montado = useSyncExternalStore(semAssinatura, () => true, () => false)
  const atual = montado ? (theme ?? "system") : undefined

  return (
    <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-3">
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
            {o.valor === "system" ? (
              <span className="flex">
                <Miniatura escuro={false} className="flex-1 pr-1" />
                <Miniatura escuro className="flex-1 pl-1" />
              </span>
            ) : (
              <Miniatura escuro={escuro} />
            )}

            {/* Em pé, e não lado a lado: as três opções dividem metade da
                tela, e em linha o texto ficava espremido uma palavra por linha. */}
            <span className="flex flex-1 flex-col gap-2 bg-card px-3.5 py-3">
              <span className="flex items-center justify-between gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icone size={16} />
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
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{o.rotulo}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{o.descricao}</span>
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
