import Link from "next/link"

import { CORES_CATEGORIA } from "@/components/agenda/cores-agenda"
import { CORES_TIME } from "@/components/tarefas/cores-time"
import { CabecalhoPainel } from "./urgentes-atrasadas"
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

/** Quantas linhas da agenda cabem no painel antes do "ver mais". */
const LIMITE = 6

/**
 * O dia de hoje em uma coluna: primeiro quantas tarefas cada time tem
 * para hoje, depois o que tem hora e não se move — perícia, prazo e
 * exigência —, como uma linha do tempo com a hora na margem.
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
  const visiveis = itens.slice(0, LIMITE)

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-card">
      <CabecalhoPainel
        titulo="Hoje"
        resumo={<span className="inline-block first-letter:uppercase">{dataPorExtenso}</span>}
        href="/agenda"
        rotuloLink="Abrir"
      />

      <div className="px-5 pt-4 pb-4">
        <p className="mb-2.5 text-[12.5px] font-medium text-muted-foreground">
          {totalHoje} {totalHoje === 1 ? "tarefa para hoje" : "tarefas para hoje"}
        </p>
        <ul className="grid grid-cols-4 gap-2">
          {TIMES_TAREFA.map((t) => (
            <li key={t} className="flex flex-col px-1 py-0.5">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-[12px]">
                <span className={cn("size-2 shrink-0 rounded-full", CORES_TIME[t].ponto)} />
                <span className="truncate">{TIME_LABEL[t]}</span>
              </span>
              <span
                className={cn(
                  "font-heading text-[22px] leading-tight font-semibold tabular-nums",
                  tarefasPorTime[t] === 0 && "text-muted-foreground/50"
                )}
              >
                {tarefasPorTime[t]}
              </span>
            </li>
          ))}
        </ul>
        {tarefasPorTime.SEM > 0 ? (
          <p className="mt-1 text-[11.5px] text-muted-foreground">e {tarefasPorTime.SEM} sem time</p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col border-t border-border">
        <p className="px-5 pt-3 pb-1 text-[12.5px] font-medium text-muted-foreground">
          Perícias, prazos e exigências
        </p>
        {visiveis.length === 0 ? (
          <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">
            Nada com data marcada para hoje.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visiveis.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-11 shrink-0 text-[12.5px] font-semibold text-muted-foreground tabular-nums">
                  {t.hora ?? "—"}
                </span>
                <span
                  className={cn(
                    "w-[74px] shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold tracking-wide uppercase",
                    CORES_CATEGORIA[t.categoria].etiqueta
                  )}
                >
                  {CATEGORIA_AGENDA_LABEL[t.categoria]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold" title={t.titulo}>
                    {t.titulo}
                  </p>
                  {t.responsavel ? (
                    <p className="truncate text-[11.5px] text-muted-foreground">{t.responsavel}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {itens.length > LIMITE ? (
          <Link
            href="/agenda"
            className="mt-auto border-t border-border px-5 py-2.5 text-center text-[12.5px] font-medium text-primary hover:bg-muted/40 dark:text-accent-foreground"
          >
            Ver os {itens.length} de hoje
          </Link>
        ) : null}
      </div>
    </section>
  )
}
