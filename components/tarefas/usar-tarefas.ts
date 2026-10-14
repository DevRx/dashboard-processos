"use client"

import { useCallback, useEffect, useState } from "react"

import type { Atribuicao } from "@/lib/domain/tarefa"
import type { Tarefa, Usuario } from "./cartao-tarefa"

/** Tarefa das telas dos times: com o vínculo do DJEN e as partes no fluxo. */
export type TarefaDoTime = Tarefa & {
  deIntimacao?: boolean | null
  createdAt?: string | null
  atribuicoes?: Atribuicao[] | null
}

export type ResultadoAcao = { ok: true } | { ok: false; status: number; erro: string }

/**
 * As tarefas em aberto do escritório, com onde cada uma está no fluxo,
 * e a equipe.
 *
 * `fluxoLigado` diz se a migration do fluxo já rodou no banco. Sem ela
 * as tarefas vêm sem partes gravadas e a tela segue as pastas do
 * TickTick.
 *
 * `agir` manda uma ação do fluxo e troca a tarefa pelo que o banco
 * devolveu. Se o banco recusar (alguém mexeu antes), a lista inteira é
 * recarregada: a tela nunca mostra o que o banco não tem.
 */
export function useTarefasDoTime() {
  const [tarefas, setTarefas] = useState<TarefaDoTime[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [fluxoLigado, setFluxoLigado] = useState(true)

  const buscar = useCallback(
    () =>
      fetch("/api/tarefas?abertas=1&vinculos=1&atribuicoes=1")
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status))
          return r.json()
        })
        .then((d) => {
          setTarefas(d.tarefas ?? [])
          setFluxoLigado(d.fluxo?.disponivel !== false)
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

  const trocar = useCallback((nova: TarefaDoTime) => {
    setTarefas((atuais) => {
      if (nova.status === "CONCLUIDA" || nova.status === "CANCELADA") return atuais.filter((t) => t.id !== nova.id)
      const existe = atuais.some((t) => t.id === nova.id)
      return existe ? atuais.map((t) => (t.id === nova.id ? { ...t, ...nova } : t)) : [...atuais, nova]
    })
  }, [])

  /** Edição simples da tarefa (responsável, prioridade, status), como antes. */
  const patch = useCallback(
    async (id: string, campos: Record<string, unknown>): Promise<boolean> => {
      setTarefas((atuais) => atuais.map((t) => (t.id === id ? { ...t, ...campos } : t)))
      const r = await fetch(`/api/tarefas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campos),
      }).catch(() => null)

      // Mexer na tarefa mexe nas partes (o banco traduz): a lista volta
      // do servidor para mostrar como ficou.
      recarregar()
      return Boolean(r?.ok)
    },
    [recarregar]
  )

  const agir = useCallback(
    async (id: string, corpo: Record<string, unknown>): Promise<ResultadoAcao> => {
      const r = await fetch(`/api/tarefas/${id}/fluxo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      }).catch(() => null)

      if (!r) {
        recarregar()
        return { ok: false, status: 0, erro: "Sem conexão com o servidor. A tela foi atualizada." }
      }
      const json = await r.json().catch(() => ({}))
      if (!r.ok) {
        if (r.status === 503) setFluxoLigado(false)
        recarregar()
        return { ok: false, status: r.status, erro: json.error ?? "Não foi possível fazer isso agora." }
      }
      trocar(json.tarefa as TarefaDoTime)
      return { ok: true }
    },
    [recarregar, trocar]
  )

  const criar = useCallback(
    async (dados: Record<string, unknown>) => {
      const r = await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      })
      if (!r.ok) return false
      const { tarefa } = await r.json()
      trocar(tarefa as TarefaDoTime)
      return true
    },
    [trocar]
  )

  return { tarefas, usuarios, carregando, erro, fluxoLigado, patch, agir, criar, recarregar }
}

/** Hoje no relógio de quem usa, não em UTC: depois das 21h em Brasília o UTC já é amanhã. */
export function hojeISO() {
  const agora = new Date()
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/**
 * Concluir de fora das telas dos times (agenda, quadro geral): fecha só
 * a parte de quem clicou. Se a tarefa tem outros responsáveis, ela
 * continua aberta para eles. Sem o fluxo ligado no banco, conclui a
 * tarefa como antes.
 */
export async function concluirMinhaParte(id: string): Promise<ResultadoAcao> {
  const r = await fetch(`/api/tarefas/${id}/fluxo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "concluirMinhaParte" }),
  }).catch(() => null)

  if (r?.ok) return { ok: true }
  if (r?.status === 503) {
    const antigo = await fetch(`/api/tarefas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONCLUIDA" }),
    }).catch(() => null)
    return antigo?.ok ? { ok: true } : { ok: false, status: antigo?.status ?? 0, erro: "Não foi possível concluir." }
  }
  const json = r ? await r.json().catch(() => ({})) : {}
  return { ok: false, status: r?.status ?? 0, erro: json.error ?? "Não foi possível concluir." }
}
