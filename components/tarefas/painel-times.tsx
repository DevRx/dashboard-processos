"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ChevronRight } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { ALERTA } from "@/components/ui/alerta"
import { cn } from "@/lib/utils"
import {
  ESFERAS_AMARELO,
  ESFERA_AMARELO_LABEL,
  ETAPAS,
  ETAPAS_DO_TIME,
  TIMES_TAREFA,
  TIME_LABEL,
  atribuicoesDa,
  enderecoDoTime,
  etapasDaEsfera,
  gruposDa,
  type EtapaId,
  type TimeTarefa,
} from "@/lib/domain/tarefa"
import { CORES_TIME } from "./cores-time"
import { hojeISO, useTarefasDoTime } from "./usar-tarefas"

/**
 * Os quatro times numa tela só — é para onde leva o botão "Times" da
 * barra do celular. Cada time mostra as etapas dele com quantas
 * tarefas há em cada uma; um toque leva à etapa.
 */
export function PainelTimes() {
  const { tarefas, carregando, erro } = useTarefasDoTime()

  // Conta cartões, não tarefas: a mesma tarefa no ADM e no Judicial
  // conta nos dois lados, como aparece nas colunas.
  const resumo = useMemo(() => {
    const hoje = hojeISO()
    const vazio = () => ({ total: 0, atrasadas: 0, porEtapa: new Map<EtapaId, number>(), atrasadasPorEtapa: new Map<EtapaId, number>(), semEtapa: 0 })
    const porTime = Object.fromEntries(TIMES_TAREFA.map((t) => [t, vazio()])) as Record<TimeTarefa, ReturnType<typeof vazio>>

    for (const t of tarefas) {
      if (t.status === "CONCLUIDA" || t.status === "CANCELADA") continue
      const atrasada = t.data.slice(0, 10) < hoje
      for (const g of gruposDa(atribuicoesDa(t))) {
        const r = porTime[g.setor]
        if (!r) continue
        r.total++
        if (atrasada) r.atrasadas++
        if (g.etapa) {
          r.porEtapa.set(g.etapa, (r.porEtapa.get(g.etapa) ?? 0) + 1)
          if (atrasada) r.atrasadasPorEtapa.set(g.etapa, (r.atrasadasPorEtapa.get(g.etapa) ?? 0) + 1)
        } else r.semEtapa++
      }
    }
    return porTime
  }, [tarefas])

  if (carregando) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    )
  }

  if (erro) return <p className="rounded-2xl bg-card p-5 text-sm shadow-card">{erro}</p>

  const linhaDaEtapa = (time: TimeTarefa, id: EtapaId) => {
    const r = resumo[time]
    const qtd = r.porEtapa.get(id) ?? 0
    const atrasadas = r.atrasadasPorEtapa.get(id) ?? 0
    return (
      <li key={id}>
        <Link
          href={`${enderecoDoTime(ETAPAS[id].time)}?${ETAPAS[id].esfera ? `lado=${ETAPAS[id].esfera === "JUDICIAL" ? "judicial" : "administrativo"}&` : ""}etapa=${ETAPAS[id].slug}`}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="min-w-0 flex-1 truncate font-medium">{ETAPAS[id].nome}</span>
          {atrasadas ? (
            <span className={cn("text-xs font-semibold", ALERTA.atrasadaTexto)}>
              {atrasadas} {atrasadas === 1 ? "atrasada" : "atrasadas"}
            </span>
          ) : null}
          <span className="font-heading min-w-8 text-right text-base font-bold tabular-nums">{qtd}</span>
          <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      </li>
    )
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {TIMES_TAREFA.map((time) => {
        const r = resumo[time]
        const n = r
        const cor = CORES_TIME[time]
        return (
          <section key={time} aria-label={`Time ${TIME_LABEL[time]}`} className="overflow-hidden rounded-2xl bg-card shadow-card">
            <Link
              href={enderecoDoTime(time)}
              className={cn(
                "flex items-center gap-3 px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                cor.cabecalho
              )}
            >
              <span className="font-heading flex-1 text-xl font-bold tracking-[0.04em] uppercase">
                {TIME_LABEL[time]}
              </span>
              <span className="text-[13px] opacity-90">
                {n.total} em aberto
                {n.atrasadas ? `, ${n.atrasadas} ${n.atrasadas === 1 ? "atrasada" : "atrasadas"}` : ""}
              </span>
              <ChevronRight size={18} aria-hidden />
            </Link>

            <div className="p-2.5">
              {time === "AMARELO" ? (
                ESFERAS_AMARELO.map((lado) => (
                  <div key={lado} className="pb-1">
                    <p className="px-3 pt-2 pb-1 text-[13px] font-semibold text-muted-foreground">
                      {ESFERA_AMARELO_LABEL[lado]}
                    </p>
                    <ul>{etapasDaEsfera(lado).map((id) => linhaDaEtapa(time, id))}</ul>
                  </div>
                ))
              ) : ETAPAS_DO_TIME[time].length ? (
                <ul>{ETAPAS_DO_TIME[time].map((id) => linhaDaEtapa(time, id))}</ul>
              ) : (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  Ainda sem etapas no fluxo — {r.total} {r.total === 1 ? "tarefa" : "tarefas"}.
                </p>
              )}

              {ETAPAS_DO_TIME[time].length && r.semEtapa ? (
                <Link
                  href={enderecoDoTime(time)}
                  className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="flex-1">Ainda sem etapa</span>
                  <span className="font-semibold tabular-nums">{r.semEtapa}</span>
                  <ChevronRight size={15} aria-hidden />
                </Link>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
