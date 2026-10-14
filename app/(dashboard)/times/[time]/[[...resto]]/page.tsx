"use client"

import { Suspense } from "react"
import { notFound, useParams, usePathname, useRouter, useSearchParams } from "next/navigation"

import { Pagina } from "@/components/layout/pagina"
import { KanbanTime, type FiltroInicial } from "@/components/tarefas/kanban-time"
import {
  ETAPAS,
  SLUG_DO_TIME,
  TIME_LABEL,
  esferaPorSlugAmarelo,
  etapaPorSlug,
  timePorSlug,
  type EsferaAmarelo,
  type TimeTarefa,
} from "@/lib/domain/tarefa"

/**
 * A tela de um time: o kanban com as etapas em colunas e os filtros no
 * alto.
 *
 *   /times/azul                         o time inteiro
 *   /times/azul?etapa=agendar-video      uma etapa só
 *   /times/amarelo?lado=judicial         um lado do amarelo
 *
 * Os endereços antigos por etapa (/times/azul/agendar-video,
 * /times/amarelo/judicial/protocolo) continuam valendo e viram filtro.
 */

const SUBTITULO: Record<TimeTarefa, string> = {
  VERMELHO: "Videochamadas, revisão das análises, andamentos e questões de clientes",
  AZUL: "Da análise do caso até o contrato assinado",
  AMARELO: "Protocolo e andamentos: administrativo e judicial",
  ROSA: "Entregas: o benefício permanente levado em mãos ao cliente",
}

const SLUG_LADO: Record<EsferaAmarelo, string> = { ADMINISTRATIVO: "administrativo", JUDICIAL: "judicial" }

function filtroDoEndereco(time: TimeTarefa, resto: string[], busca: URLSearchParams): FiltroInicial | null {
  let lado = esferaPorSlugAmarelo(busca.get("lado"))
  let etapaSlug = busca.get("etapa")
  if (resto.length) {
    if (time === "AMARELO") {
      lado = esferaPorSlugAmarelo(resto[0])
      if (!lado || resto.length > 2) return null
      etapaSlug = resto[1] ?? null
    } else {
      if (resto.length > 1) return null
      etapaSlug = resto[0]
    }
  }
  if (time !== "AMARELO") lado = null
  // No amarelo a etapa vem pelo nome curto ("protocolo") e o lado diz qual.
  const etapa = etapaSlug
    ? time === "AMARELO"
      ? etapaPorSlug(time, etapaSlug, lado ?? "ADMINISTRATIVO")
      : etapaPorSlug(time, etapaSlug)
    : null
  if (etapaSlug && !etapa) return null
  return { etapa, lado }
}

function Tela() {
  const params = useParams<{ time: string; resto?: string[] }>()
  const busca = useSearchParams()
  const router = useRouter()
  const caminho = usePathname()
  const time = timePorSlug(params.time)
  if (!time) notFound()
  const inicial = filtroDoEndereco(time, params.resto ?? [], busca)
  if (!inicial) notFound()

  const guardarFiltro = (f: FiltroInicial) => {
    const q = new URLSearchParams()
    if (f.lado) q.set("lado", SLUG_LADO[f.lado])
    if (f.etapa) q.set("etapa", ETAPAS[f.etapa].slug)
    const destino = `/times/${SLUG_DO_TIME[time]}${q.size ? `?${q}` : ""}`
    if (destino !== `${caminho}${busca.size ? `?${busca}` : ""}`) router.replace(destino, { scroll: false })
  }

  return (
    <Pagina titulo={TIME_LABEL[time]} subtitulo={SUBTITULO[time]}>
      <KanbanTime key={time} time={time} inicial={inicial} onFiltro={guardarFiltro} />
    </Pagina>
  )
}

export default function TimePage() {
  return (
    <Suspense fallback={null}>
      <Tela />
    </Suspense>
  )
}
