"use client"

import { notFound, useParams } from "next/navigation"

import { Pagina } from "@/components/layout/pagina"
import { QuadroTime, nomeDaEtapa } from "@/components/tarefas/quadro-time"
import {
  ESFERA_AMARELO_LABEL,
  SLUG_ESFERA,
  TIME_LABEL,
  enderecoDoTime,
  esferaPorSlugAmarelo,
  etapaPorSlug,
  timePorSlug,
  type EsferaAmarelo,
  type EtapaId,
  type TimeTarefa,
} from "@/lib/domain/tarefa"

/**
 * Tela de um time, de um lado do amarelo ou de uma etapa:
 *
 *   /times/azul                      o time inteiro
 *   /times/azul/agendar-video        uma etapa
 *   /times/amarelo/judicial          um lado do amarelo
 *   /times/amarelo/judicial/protocolo uma etapa do amarelo
 *
 * Qualquer outro endereço é 404.
 */

const SUBTITULO: Record<TimeTarefa, string> = {
  VERMELHO: "Videochamadas, revisão das análises e andamentos",
  AZUL: "Da análise do caso até o contrato assinado",
  AMARELO: "Antes do protocolo: administrativo e judicial",
  ROSA: "Etapas ainda não definidas no fluxo",
}

const SUBTITULO_ESFERA: Record<EsferaAmarelo, string> = {
  ADMINISTRATIVO: "Requerimentos no INSS antes do protocolo",
  JUDICIAL: "Ações antes da distribuição",
}

type Rota = { time: TimeTarefa; esfera: EsferaAmarelo | null; etapa: EtapaId | null }

function lerRota(slugTime?: string, resto?: string[]): Rota | null {
  const time = timePorSlug(slugTime)
  if (!time) return null
  const partes = resto ?? []

  if (partes.length === 0) return { time, esfera: null, etapa: null }

  if (time === "AMARELO") {
    const esfera = esferaPorSlugAmarelo(partes[0])
    if (!esfera || partes.length > 2) return null
    if (partes.length === 1) return { time, esfera, etapa: null }
    const etapa = etapaPorSlug(time, partes[1], esfera)
    return etapa ? { time, esfera, etapa } : null
  }

  if (partes.length > 1) return null
  const etapa = etapaPorSlug(time, partes[0])
  return etapa ? { time, esfera: null, etapa } : null
}

export default function TimePage() {
  const params = useParams<{ time: string; resto?: string[] }>()
  const rota = lerRota(params.time, params.resto)
  if (!rota) notFound()

  const { time, esfera, etapa } = rota
  const nomeTime = TIME_LABEL[time]

  const titulo = etapa
    ? `${nomeTime} · ${nomeDaEtapa(etapa)}`
    : esfera
      ? `${nomeTime} · ${ESFERA_AMARELO_LABEL[esfera]}`
      : nomeTime

  // A volta sobe um nível: da etapa do amarelo para o lado dele, do
  // lado (ou da etapa dos outros times) para o time.
  const voltar = etapa
    ? esfera
      ? { href: `/times/amarelo/${SLUG_ESFERA[esfera]}`, rotulo: `${nomeTime} · ${ESFERA_AMARELO_LABEL[esfera]}` }
      : { href: enderecoDoTime(time), rotulo: nomeTime }
    : esfera
      ? { href: enderecoDoTime(time), rotulo: nomeTime }
      : undefined

  return (
    <Pagina titulo={titulo} subtitulo={etapa ? undefined : esfera ? SUBTITULO_ESFERA[esfera] : SUBTITULO[time]} voltar={voltar}>
      <QuadroTime key={`${time}-${esfera}-${etapa}`} time={time} esfera={esfera} etapa={etapa} />
    </Pagina>
  )
}
