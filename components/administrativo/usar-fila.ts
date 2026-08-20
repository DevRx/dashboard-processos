"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type { SituacaoPericia } from "@/lib/domain/processo"

import type { ItemFila } from "./tipos"

/** Fase encerrada não é fila de trabalho: some do quadro. */
const STATUS_ENCERRADOS = new Set(["CONCLUIDO", "ARQUIVADO"])

/**
 * Fila administrativa e as duas edições que ela permite. O quadro e a
 * página de cada família carregam a mesma coisa e mexem nos mesmos
 * campos — separar isso em dois lugares só criaria a chance de eles
 * discordarem.
 */
export function useFilaAdministrativa() {
  const [itens, setItens] = useState<ItemFila[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(() => {
    return fetch("/api/administrativo")
      .then((r) => (r.ok ? r.json() : { itens: [] }))
      .then((data) => setItens(data.itens ?? []))
      .catch((err) => console.error("Erro ao carregar a fila:", err))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const salvarFicha = useCallback(
    async (
      clienteId: string,
      patch: { observacoes?: string; senhaMeuInss?: string }
    ) => {
      const r = await fetch(`/api/clientes/${clienteId}/ficha`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })

      if (!r.ok) throw new Error("Falha ao salvar a ficha")
      const dados = await r.json()

      // O mesmo cliente pode ocupar mais de uma família (BPC e revisão,
      // por exemplo). A ficha é uma só: atualiza em todas.
      setItens((atuais) =>
        atuais.map((item) =>
          item.cliente.id === clienteId
            ? {
                ...item,
                cliente: {
                  ...item.cliente,
                  observacoes: dados.observacoes ?? null,
                  senhaMeuInss: dados.senhaMeuInss ?? null,
                },
              }
            : item
        )
      )
    },
    []
  )

  const trocarPericia = useCallback(
    async (processoId: string, situacao: SituacaoPericia) => {
      const r = await fetch(`/api/processos/${processoId}/pericia`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situacaoPericia: situacao }),
      })

      if (!r.ok) return

      setItens((atuais) =>
        atuais.map((item) =>
          item.processoId === processoId
            ? { ...item, situacaoPericia: situacao }
            : item
        )
      )
    },
    []
  )

  const ativos = useMemo(
    () => itens.filter((i) => !i.status || !STATUS_ENCERRADOS.has(i.status)),
    [itens]
  )

  return { ativos, carregando, salvarFicha, trocarPericia }
}
