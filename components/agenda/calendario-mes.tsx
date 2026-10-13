"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Um mês em grade, de domingo a sábado.
 *
 * Genérico de propósito: a agenda tem dois calendários — o geral e o de
 * perícias e prazos — e o que muda entre eles é só o que cabe dentro de
 * cada dia. Isso entra por `conteudoDoDia`; a grade, a navegação entre
 * meses e o dia escolhido são daqui.
 *
 * As datas são texto `AAAA-MM-DD` do começo ao fim. `Date` só aparece
 * para descobrir em que dia da semana o mês começa, e sempre em UTC —
 * assim fuso horário nenhum empurra a perícia para o dia seguinte.
 */

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const DIAS_SEMANA_CURTO = ["D", "S", "T", "Q", "Q", "S", "S"]

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

function iso(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

/** As células do mês: os dias dele e as pontas dos meses vizinhos. */
function celulasDoMes(ano: number, mes: number) {
  const primeiro = new Date(Date.UTC(ano, mes, 1))
  const inicio = primeiro.getUTCDay()
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  const linhas = Math.ceil((inicio + diasNoMes) / 7)

  return Array.from({ length: linhas * 7 }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes, 1 - inicio + i))
    return {
      data: iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      dia: d.getUTCDate(),
      doMes: d.getUTCMonth() === mes,
    }
  })
}

export function CalendarioMes({
  titulo,
  subtitulo,
  icone: Icone,
  legenda,
  hoje,
  selecionado,
  onSelecionar,
  conteudoDoDia,
  totalDoDia,
  children,
}: {
  titulo: string
  subtitulo?: string
  icone: LucideIcon
  legenda?: React.ReactNode
  /** `AAAA-MM-DD` de hoje, no fuso de quem está olhando. */
  hoje: string
  selecionado: string
  onSelecionar: (data: string) => void
  /** O que aparece dentro da célula — contagens, etiquetas, pontos. */
  conteudoDoDia: (data: string) => React.ReactNode
  /** Quantos itens há no dia; zero deixa a célula sem destaque. */
  totalDoDia: (data: string) => number
  /** Embaixo da grade: o detalhe do dia escolhido. */
  children?: React.ReactNode
}) {
  const [ano0, mes0] = hoje.split("-").map(Number)
  const [visto, setVisto] = useState({ ano: ano0, mes: mes0 - 1 })

  function andar(passo: number) {
    setVisto(({ ano, mes }) => {
      const d = new Date(Date.UTC(ano, mes + passo, 1))
      return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() }
    })
  }

  const celulas = celulasDoMes(visto.ano, visto.mes)
  const noMesDeHoje = visto.ano === ano0 && visto.mes === mes0 - 1

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-4 pb-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/80">
          <Icone size={18} strokeWidth={2} />
        </span>
        {/* Largura mínima: no celular a navegação desce para a linha de
            baixo em vez de espremer o título numa coluna de uma palavra. */}
        <div className="min-w-[200px] flex-1">
          <h2 className="font-heading text-[15px] leading-tight font-semibold">{titulo}</h2>
          {subtitulo ? (
            <p className="text-[12px] text-muted-foreground">{subtitulo}</p>
          ) : null}
        </div>

        <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start">
          <button
            type="button"
            onClick={() => andar(-1)}
            aria-label="Mês anterior"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[124px] text-center text-[13px] font-semibold capitalize tabular-nums">
            {MESES[visto.mes]} {visto.ano}
          </span>
          <button
            type="button"
            onClick={() => andar(1)}
            aria-label="Próximo mês"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setVisto({ ano: ano0, mes: mes0 - 1 })
              onSelecionar(hoje)
            }}
            disabled={noMesDeHoje && selecionado === hoje}
            className="ml-1 h-8 rounded-lg px-2.5 text-[12px] font-semibold text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            Hoje
          </button>
        </div>

        {legenda ? <div className="w-full">{legenda}</div> : null}
      </header>

      <div className="px-2 pb-2 sm:px-3 sm:pb-3">
        <div className="grid grid-cols-7 pb-1">
          {DIAS_SEMANA.map((d, i) => (
            <span
              key={d}
              className="text-center text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{DIAS_SEMANA_CURTO[i]}</span>
            </span>
          ))}
        </div>

        <div
          role="grid"
          aria-label={`${titulo} — ${MESES[visto.mes]} de ${visto.ano}`}
          className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border"
        >
          {celulas.map((c) => {
            const ehHoje = c.data === hoje
            const escolhido = c.data === selecionado
            const total = totalDoDia(c.data)

            return (
              <button
                key={c.data}
                type="button"
                role="gridcell"
                aria-selected={escolhido}
                aria-label={`${c.dia} de ${MESES[Number(c.data.slice(5, 7)) - 1]}${total ? ` — ${total} ${total === 1 ? "item" : "itens"}` : ""}`}
                onClick={() => onSelecionar(c.data)}
                className={cn(
                  "group relative flex min-h-[54px] flex-col items-stretch gap-1 p-1 text-left outline-none transition-colors sm:min-h-[84px] sm:p-1.5",
                  c.doMes ? "bg-card hover:bg-muted/50" : "bg-muted/40 text-muted-foreground/60 hover:bg-muted/60",
                  // Hoje e o dia escolhido ficam em preto e branco: rosa,
                  // vermelho e as outras cores do mês são dos times.
                  escolhido && "bg-accent hover:bg-accent",
                  "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums",
                    ehHoje && "bg-foreground text-background",
                    escolhido && !ehHoje && "ring-2 ring-foreground/70"
                  )}
                >
                  {c.dia}
                </span>
                {total > 0 ? conteudoDoDia(c.data) : null}
              </button>
            )
          })}
        </div>
      </div>

      {children}
    </section>
  )
}
