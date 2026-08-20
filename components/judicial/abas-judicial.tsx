"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Scale } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * As duas faces do judicial: as ações em curso e o que o diário
 * publicou sobre elas. Uma navegação só, porque na prática o trabalho
 * vai e volta entre as duas várias vezes ao dia.
 */
const ABAS = [
  { href: "/judicial", rotulo: "Ações", icone: Scale },
  { href: "/judicial/intimacoes", rotulo: "Intimações", icone: Bell },
]

export function AbasJudicial({ pendentes }: { pendentes?: number }) {
  const pathname = usePathname()

  return (
    <div className="flex w-fit rounded-lg bg-muted p-0.5">
      {ABAS.map((aba) => {
        const Icone = aba.icone
        const ativa =
          aba.href === "/judicial"
            ? pathname === "/judicial"
            : pathname.startsWith(aba.href)

        return (
          <Link
            key={aba.href}
            href={aba.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              ativa
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icone size={14} />
            {aba.rotulo}
            {aba.href === "/judicial/intimacoes" && pendentes ? (
              <span className="rounded bg-red-600 px-1 text-[10.5px] font-bold text-white tabular-nums">
                {pendentes}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
