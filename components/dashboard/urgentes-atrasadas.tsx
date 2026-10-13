import Link from "next/link"
import { AlarmClock, ArrowRight } from "lucide-react"

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

/** Cabeçalho comum aos painéis do Dashboard: mesma altura, mesmo peso. */
export function CabecalhoPainel({
  titulo,
  resumo,
  href,
  rotuloLink,
}: {
  titulo: string
  resumo?: React.ReactNode
  href?: string
  rotuloLink?: string
}) {
  return (
    <header className="flex min-h-14 items-center gap-3 border-b border-border px-5 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="font-heading text-[15px] leading-tight font-semibold">{titulo}</h2>
        {resumo ? <p className="truncate text-[12px] text-muted-foreground">{resumo}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-accent dark:text-accent-foreground"
        >
          {rotuloLink}
          <ArrowRight size={14} />
        </Link>
      ) : null}
    </header>
  )
}

/**
 * O que não pode esperar.
 *
 * O destaque da tela é a régua de atrasadas por time: uma barra só,
 * dividida na proporção de cada cor, com o número de cada time logo
 * embaixo. Ela responde "quem está devendo?" num relance. As urgentes
 * vêm depois, como linhas de tabela — alinhadas, sem cartão dentro de
 * cartão —, com o prazo encostado à direita.
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
  const somaTimes = TIMES_TAREFA.reduce((s, t) => s + atrasadas[t], 0)

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-card">
      <CabecalhoPainel
        titulo="Urgentes e atrasadas"
        resumo={`${totalUrgentes} ${totalUrgentes === 1 ? "urgente" : "urgentes"} · ${totalAtrasadas} ${totalAtrasadas === 1 ? "atrasada" : "atrasadas"}`}
        href="/agenda"
        rotuloLink="Agenda"
      />

      {/* Régua de atrasadas por time */}
      <div className="px-5 pt-4 pb-4">
        <p className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
          <AlarmClock size={13} className={ALERTA.atrasadaTexto} />
          Atrasadas por time
        </p>

        <div
          aria-hidden
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
        >
          {somaTimes > 0
            ? TIMES_TAREFA.map((t) =>
                atrasadas[t] > 0 ? (
                  <span
                    key={t}
                    className={cn("h-full", CORES_TIME[t].ponto)}
                    style={{ width: `${(atrasadas[t] / somaTimes) * 100}%` }}
                  />
                ) : null
              )
            : null}
        </div>

        <ul className="mt-3 grid grid-cols-4 gap-2">
          {TIMES_TAREFA.map((t) => (
            <li key={t}>
              <Link
                href="/tarefas"
                className="flex flex-col rounded-lg px-1 py-0.5 transition-colors hover:bg-muted/50"
              >
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-[12px]">
                  <span className={cn("size-2 shrink-0 rounded-full", CORES_TIME[t].ponto)} />
                  <span className="truncate">{TIME_LABEL[t]}</span>
                </span>
                <span
                  className={cn(
                    "font-heading text-[22px] leading-tight font-semibold tabular-nums",
                    atrasadas[t] === 0 && "text-muted-foreground/50"
                  )}
                >
                  {atrasadas[t]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {atrasadas.SEM > 0 ? (
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            e {atrasadas.SEM} sem time
          </p>
        ) : null}
      </div>

      {/* Urgentes, como linhas */}
      <div className="flex flex-1 flex-col border-t border-border">
        <p className="px-5 pt-3 pb-1 text-[12.5px] font-medium text-muted-foreground">
          Urgentes
        </p>
        {urgentes.length === 0 ? (
          <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">
            Nenhuma tarefa urgente em aberto.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {urgentes.map((t) => {
              const paleta = paletaDe(t.setor)
              const atrasada = t.data.slice(0, 10) < hoje
              return (
                <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span
                    aria-hidden
                    className={cn("h-8 w-1 shrink-0 rounded-full", paleta?.ponto ?? "bg-muted-foreground/30")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold" title={t.titulo}>
                      {t.titulo}
                    </p>
                    <p className="truncate text-[11.5px] text-muted-foreground">
                      {t.responsavel ?? "Sem responsável"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums",
                      atrasada ? ALERTA.atrasada : "text-muted-foreground"
                    )}
                  >
                    {atrasada ? <AlarmClock size={11} /> : null}
                    {quando(t.data, hoje)}
                    {t.hora ? ` · ${t.hora}` : ""}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {totalUrgentes > urgentes.length ? (
          <Link
            href="/agenda"
            className="mt-auto border-t border-border px-5 py-2.5 text-center text-[12.5px] font-medium text-primary hover:bg-muted/40 dark:text-accent-foreground"
          >
            Ver as {totalUrgentes} urgentes
          </Link>
        ) : null}
      </div>
    </section>
  )
}
