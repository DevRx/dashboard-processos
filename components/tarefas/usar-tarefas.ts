"use client"

import { useCallback, useEffect, useRef, useState } from "react"

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
const LISTA = "/api/tarefas?abertas=1&vinculos=1&atribuicoes=1"

export function useTarefasDoTime() {
  const [tarefas, setTarefas] = useState<TarefaDoTime[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [fluxoLigado, setFluxoLigado] = useState(true)
  // O instante da última leitura, pelo relógio do banco: a próxima
  // recarga pede só o que mudou desde então.
  const desde = useRef<string | null>(null)

  /**
   * Aplica uma lista de tarefas sobre a tela: as que fecharam saem, as
   * outras entram ou são trocadas. É o que uma recarga "só o que mudou"
   * devolve — e também o que a lista inteira devolve, quando `tudo`.
   */
  const aplicar = useCallback((lista: TarefaDoTime[], tudo: boolean) => {
    setTarefas((atuais) => {
      if (tudo) return lista.filter((t) => t.status !== "CONCLUIDA" && t.status !== "CANCELADA")
      const porId = new Map(atuais.map((t) => [t.id, t]))
      for (const t of lista) {
        if (t.status === "CONCLUIDA" || t.status === "CANCELADA") porId.delete(t.id)
        else porId.set(t.id, { ...(porId.get(t.id) ?? {}), ...t })
      }
      return [...porId.values()]
    })
  }, [])

  const buscar = useCallback(
    (soMudancas = false) => {
      const caminho = soMudancas && desde.current ? `${LISTA}&desde=${encodeURIComponent(desde.current)}` : LISTA
      return fetch(caminho)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status))
          return r.json()
        })
        .then((d) => {
          // Sem `agora` o servidor seguiu o caminho antigo e mandou tudo.
          const parcial = Boolean(soMudancas && desde.current && d.agora)
          aplicar(d.tarefas ?? [], !parcial)
          desde.current = d.agora ?? null
          setFluxoLigado(d.fluxo?.disponivel !== false)
          setErro(null)
        })
    },
    [aplicar]
  )

  useEffect(() => {
    const equipe = fetch("/api/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsuarios(d.users ?? []))

    Promise.all([buscar(), equipe])
      .catch(() => setErro("Não foi possível carregar as tarefas. Recarregue a página."))
      .finally(() => setCarregando(false))
  }, [buscar])

  /** Atualiza a tela com o que mudou desde a última leitura — poucas linhas, não a lista inteira. */
  const recarregar = useCallback(() => {
    buscar(true).catch(() => setErro("Não foi possível atualizar as tarefas. Recarregue a página."))
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

      // Mexer na tarefa mexe nas partes (o banco traduz). O servidor
      // devolve a tarefa como ficou, com as partes: só este cartão é
      // trocado. Se a resposta vier sem elas, a tela pede o que mudou.
      const json = r ? await r.json().catch(() => ({})) : {}
      const nova = json.tarefa as TarefaDoTime | undefined
      if (r?.ok && nova && Array.isArray(nova.atribuicoes)) trocar(nova)
      else recarregar()
      return Boolean(r?.ok)
    },
    [recarregar, trocar]
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
