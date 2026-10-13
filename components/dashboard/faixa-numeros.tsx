import Link from "next/link"

import { ALERTA } from "@/components/ui/alerta"
import { cn } from "@/lib/utils"

export type Numero = {
  rotulo: string
  valor: number
  detalhe: string
  href: string
  /** Atraso pinta o número de laranja — a cor de alerta do sistema. */
  atraso?: boolean
}

/**
 * Os números do escritório numa faixa só.
 *
 * Quatro cartões soltos, cada um com ícone, frase e link, liam como
 * quatro assuntos. Numa faixa única, separados por fio, viram uma
 * linha de placar: o olho corre da esquerda para a direita e para no
 * que está laranja. No celular a faixa vira um quadro de dois por dois.
 */
export function FaixaNumeros({ numeros }: { numeros: Numero[] }) {
  return (
    <section
      aria-label="Números do escritório"
      className="grid grid-cols-2 overflow-hidden rounded-2xl bg-card shadow-card md:grid-cols-4"
    >
      {numeros.map((n, i) => (
        <Link
          key={n.rotulo}
          href={n.href}
          className={cn(
            "group flex flex-col gap-1 px-5 py-4 transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/50",
            // Fios entre as células: à esquerda de quem não abre a linha,
            // em cima de quem está na segunda linha do celular.
            i % 2 === 1 && "border-l border-border",
            i >= 2 && "border-t border-border md:border-t-0",
            i === 2 && "md:border-l"
          )}
        >
          <span className="text-[12.5px] font-medium text-muted-foreground">{n.rotulo}</span>
          <span
            className={cn(
              "font-heading text-[30px] leading-none font-semibold tracking-tight tabular-nums",
              n.atraso && n.valor > 0 && ALERTA.atrasadaTexto
            )}
          >
            {n.valor.toLocaleString("pt-BR")}
          </span>
          <span className="truncate text-[12px] text-muted-foreground group-hover:text-foreground/80">
            {n.detalhe}
          </span>
        </Link>
      ))}
    </section>
  )
}
