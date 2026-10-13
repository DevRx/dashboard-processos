import Link from "next/link"
import { AlarmClock, ArrowRight, Flame, UserRound } from "lucide-react"

import { CORES_TIME, paletaDe } from "@/components/tarefas/cores-time"
import { ALERTA } from "@/components/ui/alerta"
import { cn } from "@/lib/utils"
import { TIMES_TAREFA, TIME_LABEL, type TimeTarefa } from "@/lib/domain/tarefa"

export type ItemUrgente = {
  id: string
  titulo: string
  data: string
  hora: string | null
  setor: string | null
  responsavel: string | null
}

export type AtrasadasPorTime = Record<TimeTarefa | "SEM", number>

function quando(data: string, hoje: string) {
  const dias = Math.round(
    (Date.parse(`${data.slice(0, 10)}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000
  )
  if (dias === 0) return "hoje"
  if (dias === 1) return "amanhã"
  if (dias === -1) return "ontem"
  return dias < 0 ? `há ${-dias} dias` : `em ${dias} dias`
}

/**
 * O que não pode esperar: as urgentes, e quantas atrasadas cada time
 * carrega.
 *
 * O quadrinho por time vem primeiro porque responde a pergunta do dono
 * do escritório — "quem está devendo?" — antes da lista. O número de
 * cada time fica na cor do time; o atraso em si é laranja, para não
 * se confundir com o vermelho do time vermelho.
 */
export function UrgentesAtrasadas({
  urgentes,
  totalUrgentes,
  atrasadas,
  totalAtrasadas,
  hoje,
}: {
  urgentes: ItemUrgente[]
  totalUrgentes: number
  atrasadas: AtrasadasPorTime
  totalAtrasadas: number
  hoje: string
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-card">
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ALERTA.urgente)}>
          <Flame size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[16px] leading-tight font-semibold">Urgentes e atrasadas</h2>
          <p className="text-[12px] text-muted-foreground">
            {totalUrgentes} {totalUrgentes === 1 ? "urgente" : "urgentes"} · {totalAtrasadas}{" "}
            {totalAtrasadas === 1 ? "atrasada" : "atrasadas"}
          </p>
        </div>
        <Link
          href="/agenda"
          className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-primary hover:underline dark:text-accent-foreground"
        >
          Agenda
          <ArrowRight size={14} />
        </Link>
      </header>

      {/* Atrasadas por time: um número por cor. */}
      <div className="px-5 pb-4">
        <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
          <AlarmClock size={13} className={ALERTA.atrasadaTexto} />
          Atrasadas por time
        </p>
        <div className="grid grid-cols-4 gap-2">
          {TIMES_TAREFA.map((t) => (
            <Link
              key={t}
              href="/tarefas"
              title={`${TIME_LABEL[t]}: ${atrasadas[t]} atrasadas`}
              className="group overflow-hidden rounded-xl bg-muted/50 text-center ring-1 ring-border transition-shadow hover:shadow-card"
            >
              <span aria-hidden className={cn("block h-1.5", CORES_TIME[t].ponto)} />
              <span
                className={cn(
                  "font-heading block pt-2 text-[22px] leading-none font-semibold tabular-nums",
                  atrasadas[t] === 0 && "text-muted-foreground/60"
                )}
              >
                {atrasadas[t]}
              </span>
              <span className="block truncate px-1 pt-1 pb-2 text-[11px] font-medium text-muted-foreground">
                {TIME_LABEL[t]}
              </span>
            </Link>
          ))}
        </div>
        {atrasadas.SEM > 0 ? (
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            + {atrasadas.SEM} {atrasadas.SEM === 1 ? "atrasada" : "atrasadas"} sem time
          </p>
        ) : null}
      </div>

      <div className="border-t border-border px-3 py-3">
        {urgentes.length === 0 ? (
          <p className="px-2 py-4 text-center text-[13px] text-muted-foreground">
            Nenhuma tarefa urgente em aberto.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {urgentes.map((t) => {
              const paleta = paletaDe(t.setor)
              const atrasada = t.data.slice(0, 10) < hoje
              return (
                <li
                  key={t.id}
                  className={cn(
                    "rounded-xl border-l-4 px-3 py-2",
                    paleta ? cn(paleta.cartao, paleta.borda) : "border-l-muted-foreground/30 bg-muted/40"
                  )}
                >
                  <p className="truncate text-[13px] font-semibold" title={t.titulo}>
                    {t.titulo}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11.5px] text-muted-foreground">
                    <span className={cn("inline-flex items-center gap-1", atrasada && cn("font-semibold", ALERTA.atrasadaTexto))}>
                      {atrasada ? <AlarmClock size={11} /> : null}
                      {atrasada ? "atrasada · " : ""}
                      {quando(t.data, hoje)}
                      {t.hora ? ` · ${t.hora}` : ""}
                    </span>
                    {t.responsavel ? (
                      <span className="inline-flex items-center gap-1">
                        <UserRound size={11} />
                        {t.responsavel}
                      </span>
                    ) : null}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
        {totalUrgentes > urgentes.length ? (
          <Link
            href="/agenda"
            className="mt-2 block rounded-lg px-2 py-1.5 text-center text-[12.5px] font-medium text-primary hover:bg-muted dark:text-accent-foreground"
          >
            Ver as {totalUrgentes} urgentes na agenda
          </Link>
        ) : null}
      </div>
    </section>
  )
}
