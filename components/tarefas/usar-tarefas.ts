"use client"

import { useCallback, useEffect, useState } from "react"

import type { Tarefa, Usuario } from "./cartao-tarefa"

/** Tarefa da tela dos times: a do quadro, sabendo se veio do DJEN. */
export type TarefaDoTime = Tarefa & { deIntimacao?: boolean | null }

/**
 * As tarefas em aberto do escritório e a equipe, para as telas dos
 * times. `vinculos=1` traz quem nasceu de intimação do DJEN — é o que
 * põe o prazo sem pasta na etapa Andamentos do vermelho.
 *
 * `patch` muda a tela na hora e confirma no servidor; se o servidor
 * recusar, a lista volta ao que o banco tem e a função devolve `false`.
 */
export function useTarefasDoTime() {
  const [tarefas, setTarefas] = useState<TarefaDoTime[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const buscar = useCallback(
    () =>
      fetch("/api/tarefas?abertas=1&vinculos=1")
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status))
          return r.json()
        })
        .then((d) => {
          setTarefas(d.tarefas ?? [])
          setErro(null)
        }),
    []
  )

  useEffect(() => {
    const equipe = fetch("/api/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsuarios(d.users ?? []))

    Promise.all([buscar(), equipe])
      .catch(() => setErro("Não foi possível carregar as tarefas. Recarregue a página."))
      .finally(() => setCarregando(false))
  }, [buscar])

  const recarregar = useCallback(() => {
    buscar().catch(() => setErro("Não foi possível atualizar as tarefas. Recarregue a página."))
  }, [buscar])

  const patch = useCallback(
    async (id: string, campos: Record<string, unknown>): Promise<boolean> => {
      setTarefas((atuais) => atuais.map((t) => (t.id === id ? { ...t, ...campos } : t)))

      const r = await fetch(`/api/tarefas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campos),
      }).catch(() => null)

      if (!r?.ok) {
        recarregar()
        return false
      }

      const { tarefa } = await r.json()
      setTarefas((atuais) => atuais.map((t) => (t.id === id ? { ...t, ...tarefa } : t)))
      return true
    },
    [recarregar]
  )

  const criar = useCallback(async (dados: Record<string, unknown>) => {
    const r = await fetch("/api/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    })
    if (!r.ok) return
    const { tarefa } = await r.json()
    setTarefas((atuais) => [...atuais, tarefa])
  }, [])

  return { tarefas, usuarios, carregando, erro, patch, criar, recarregar }
}

export function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Números do alto de cada tela de time. */
export function contar(lista: Tarefa[]) {
  const hoje = hojeISO()
  return {
    total: lista.length,
    atrasadas: lista.filter((t) => t.data.slice(0, 10) < hoje).length,
    urgentes: lista.filter((t) => t.prioridade === "URGENTE").length,
    semResponsavel: lista.filter((t) => !t.responsavelId).length,
  }
}
