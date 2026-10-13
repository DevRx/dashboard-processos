import Link from "next/link"
import { ArrowRight, CalendarDays, Clock, UserRound } from "lucide-react"

import { CORES_CATEGORIA } from "@/components/agenda/cores-agenda"
import { CORES_TIME } from "@/components/tarefas/cores-time"
import { cn } from "@/lib/utils"
import {
  CATEGORIA_AGENDA_LABEL,
  TIMES_TAREFA,
  TIME_LABEL,
  type CategoriaAgenda,
  type TimeTarefa,
} from "@/lib/domain/tarefa"

export type ItemAgendaDoDia = {
  id: string
  titulo: string
  hora: string | null
  categoria: CategoriaAgenda
  responsavel: string | null
}

/**
 * O dia de hoje em uma olhada: quantas tarefas cada time tem para hoje
 * e, embaixo, o que tem data que não se move — perícia, prazo e
 * exigência, com as mesmas cores do calendário da agenda.
 */
export function AgendaDoDia({
  dataPorExtenso,
  itens,
  tarefasPorTime,
  totalHoje,
}: {
  dataPorExtenso: string
  itens: ItemAgendaDoDia[]
  tarefasPorTime: Record<TimeTarefa | "SEM", number>
  totalHoje: number
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-card">
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/80">
          <CalendarDays size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[16px] leading-tight font-semibold">Agenda de hoje</h2>
          <p className="truncate text-[12px] text-muted-foreground first-letter:uppercase">
            {dataPorExtenso}
          </p>
        </div>
        <Link
          href="/agenda"
          className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-primary hover:underline dark:text-accent-foreground"
        >
          Abrir
          <ArrowRight size={14} />
        </Link>
      </header>

      <div className="px-5 pb-4">
        <p className="mb-2 text-[12px] font-semibold text-muted-foreground">
          {totalHoje} {totalHoje === 1 ? "tarefa para hoje" : "tarefas para hoje"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TIMES_TAREFA.map((t) => (
            <span
              key={t}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                tarefasPorTime[t] > 0 ? CORES_TIME[t].cabecalho : "bg-muted text-muted-foreground"
              )}
            >
              {TIME_LABEL[t]}
              <span className="tabular-nums">{tarefasPorTime[t]}</span>
            </span>
          ))}
          {tarefasPorTime.SEM > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">
              Sem time
              <span className="tabular-nums">{tarefasPorTime.SEM}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex-1 border-t border-border px-3 py-3">
        {itens.length === 0 ? (
          <p className="px-2 py-4 text-center text-[13px] text-muted-foreground">
            Nenhuma perícia, prazo ou exigência hoje.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {itens.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border-l-4 bg-muted/40 px-3 py-2",
                  CORES_CATEGORIA[t.categoria].faixa
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                    CORES_CATEGORIA[t.categoria].etiqueta
                  )}
                >
                  {CATEGORIA_AGENDA_LABEL[t.categoria]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold" title={t.titulo}>
                    {t.titulo}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11.5px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {t.hora ?? "sem hora"}
                    </span>
                    {t.responsavel ? (
                      <span className="inline-flex items-center gap-1">
                        <UserRound size={11} />
                        {t.responsavel}
                      </span>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
