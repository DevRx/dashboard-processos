"use client"

import { notFound, useParams } from "next/navigation"

import { Pagina } from "@/components/layout/pagina"
import { QuadroPreProcessual } from "@/components/tarefas/quadro-pre-processual"
import { ESFERA_PRE_LABEL, esferaPorSlug } from "@/lib/domain/tarefa"

/**
 * Pré-processual de uma esfera: /tarefas/pre-processual/administrativo
 * ou /tarefas/pre-processual/judicial. Qualquer outro endereço é 404.
 */
export default function PreProcessualEsferaPage() {
  const params = useParams<{ esfera: string }>()
  const esfera = esferaPorSlug(params.esfera)
  if (!esfera) notFound()

  return (
    <Pagina
      titulo={`Pré-processual · ${ESFERA_PRE_LABEL[esfera]}`}
      subtitulo="Tarefas antes do protocolo, por responsável ou por etapa"
    >
      <QuadroPreProcessual key={esfera} esfera={esfera} />
    </Pagina>
  )
}
