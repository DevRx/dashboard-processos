"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"
import {
  AlertTriangle,
  Bell,
  Download,
  Loader2,
  Search,
  Clock,
  RefreshCw,
  Sparkles,
  Sparkles as SparklesIcon,
  Wand2,
} from "lucide-react"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import {
  CartaoIntimacao,
  type Intimacao,
  type Usuario,
} from "@/components/intimacoes/cartao-intimacao"
import {
  TIMES_TAREFA,
  TIME_LABEL,
  type TimeTarefa,
} from "@/lib/domain/tarefa"
import { AbasJudicial } from "@/components/judicial/abas-judicial"
import { cn } from "@/lib/utils"

/**
 * Intimações do DJEN.
 *
 * A tela abre com o que já está guardado e só vai ao diário quando
 * alguém pede — "Buscar no DJEN". Assim a caixa de entrada continua de
 * pé quando o serviço do CNJ não está, e a busca é um ato consciente,
 * não um efeito colateral de abrir a página.
 */

type Filtro = "urgente" | "pendentes" | "prazo" | "todas"

/** A partir daqui o prazo é assunto de hoje, não da semana que vem. */
const DIAS_URGENTE = 3

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function emDias(dias: number) {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Vencido primeiro, depois o que vence antes.
 *
 * Quem abre esta tela está procurando o que estoura hoje; a ordem da
 * publicação no diário não ajuda nisso. Intimação sem prazo explícito
 * vai para o fim, e entre elas vale a mais recente — é a que ainda
 * pode esconder um prazo que a leitura automática não pegou.
 */
function porPrazo(a: Intimacao, b: Intimacao) {
  const pa = a.prazo_estimado?.slice(0, 10)
  const pb = b.prazo_estimado?.slice(0, 10)

  if (pa && pb) return pa.localeCompare(pb)
  if (pa) return -1
  if (pb) return 1

  return b.data_disponibilizacao.localeCompare(a.data_disponibilizacao)
}

/**
 * Preferência de criar tarefa automática, guardada no navegador.
 *
 * `localStorage` é estado externo ao React, e lê-lo dentro de um
 * efeito faria a tela renderizar duas vezes a cada abertura.
 * `useSyncExternalStore` é a porta certa: no servidor devolve o padrão
 * (ligado), no cliente o que estiver guardado.
 */
const CHAVE_AUTOMATICO = "intimacoes:automatico"
const ouvintes = new Set<() => void>()

function assinarPreferencia(callback: () => void) {
  ouvintes.add(callback)
  window.addEventListener("storage", callback)
  return () => {
    ouvintes.delete(callback)
    window.removeEventListener("storage", callback)
  }
}

function usePreferenciaAutomatica() {
  return useSyncExternalStore(
    assinarPreferencia,
    () => localStorage.getItem(CHAVE_AUTOMATICO) !== "0",
    () => true
  )
}

function alternarAutomatico(ligado: boolean) {
  localStorage.setItem(CHAVE_AUTOMATICO, ligado ? "1" : "0")
  ouvintes.forEach((notificar) => notificar())
}

const CHAVE_TIME = "intimacoes:time"

function useTimePadrao() {
  return useSyncExternalStore(
    assinarPreferencia,
    () => localStorage.getItem(CHAVE_TIME) ?? "",
    () => ""
  )
}

function definirTimePadrao(time: string) {
  localStorage.setItem(CHAVE_TIME, time)
  ouvintes.forEach((notificar) => notificar())
}

type UltimaAutomatica = {
  created_at: string
  diasDesde: number
  detalhes: {
    ok?: boolean
    novas?: number
    tarefasCriadas?: number
    motivo?: string
  } | null
}

/**
 * Quando a rotina agendada passou por aqui pela última vez.
 *
 * Automação silenciosa que parou de rodar é pior que automação
 * nenhuma: o escritório passa a confiar numa varredura que não
 * acontece. Esta linha existe para o silêncio ter data.
 */
function RotinaAutomatica({
  ultima,
}: {
  ultima: UltimaAutomatica | null
}) {
  if (!ultima) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Clock size={12} />
        Rotina automática ainda não rodou — veja o README para agendá-la.
      </p>
    )
  }

  const quando = new Date(ultima.created_at)
  const dias = ultima.diasDesde
  const carimbo = `${quando.toLocaleDateString("pt-BR")} às ${quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
  const falhou = ultima.detalhes?.ok === false

  return (
    <p
      className={cn(
        "mt-2 flex items-center gap-1.5 text-[11.5px]",
        falhou || dias >= 3
          ? "font-medium text-red-700 dark:text-red-300"
          : "text-muted-foreground"
      )}
    >
      <Clock size={12} />
      Rotina automática: {carimbo}
      {falhou
        ? ` — falhou (${ultima.detalhes?.motivo ?? "motivo não registrado"})`
        : ` — ${ultima.detalhes?.novas ?? 0} nova(s), ${ultima.detalhes?.tarefasCriadas ?? 0} tarefa(s)`}
      {!falhou && dias >= 3 ? ` · há ${dias} dias sem rodar` : ""}
    </p>
  )
}

export default function IntimacoesPage() {
  const [intimacoes, setIntimacoes] = useState<Intimacao[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [oab, setOab] = useState({ numero: "", uf: "" })
  const [carregando, setCarregando] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(
    null
  )
  const [filtroEscolhido, setFiltroEscolhido] = useState<Filtro | null>(null)
  const [busca, setBusca] = useState("")
  const automatico = usePreferenciaAutomatica()
  const timePadrao = useTimePadrao()
  const [gerando, setGerando] = useState(false)
  const [recalculando, setRecalculando] = useState(false)
  const [analisandoLote, setAnalisandoLote] = useState(false)
  const [ultimaAutomatica, setUltimaAutomatica] =
    useState<UltimaAutomatica | null>(null)

  const carregar = useCallback(() => {
    const lista = fetch("/api/intimacoes")
      .then((r) => (r.ok ? r.json() : { intimacoes: [] }))
      .then((d) => {
        setIntimacoes(d.intimacoes ?? [])
        if (d.oab) setOab(d.oab)
        setUltimaAutomatica(d.ultimaAutomatica ?? null)
      })

    const equipe = fetch("/api/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsuarios(d.users ?? []))

    return Promise.all([lista, equipe])
      .catch((err) => console.error("Erro ao carregar intimações:", err))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function buscarNoDjen() {
    setBuscando(true)
    setAviso(null)
    try {
      const r = await fetch("/api/intimacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroOab: oab.numero,
          ufOab: oab.uf,
          criarTarefas: automatico,
          time: timePadrao || null,
        }),
      })
      const dados = await r.json()

      if (!r.ok) {
        setAviso({ tipo: "erro", texto: dados.error ?? "Falha na busca" })
        return
      }

      setAviso({
        tipo: "ok",
        texto:
          dados.novas > 0
            ? `${dados.novas} nova(s) de ${dados.encontradas} publicada(s) nos últimos 30 dias.` +
              (dados.tarefasCriadas > 0
                ? ` ${dados.tarefasCriadas} tarefa(s) já criada(s) com a data do prazo.`
                : "")
            : `Nenhuma nova. ${dados.encontradas} publicada(s) no período já estavam aqui.`,
      })

      await carregar()
    } catch {
      setAviso({ tipo: "erro", texto: "Não foi possível falar com o DJEN." })
    } finally {
      setBuscando(false)
    }
  }

  async function gerarPendentes() {
    setGerando(true)
    setAviso(null)
    try {
      const r = await fetch("/api/intimacoes/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: timePadrao || null }),
      })
      const dados = await r.json()

      if (!r.ok) {
        setAviso({ tipo: "erro", texto: dados.error ?? "Falha ao gerar" })
        return
      }

      setAviso({
        tipo: "ok",
        texto:
          dados.criadas > 0
            ? `${dados.criadas} tarefa(s) criada(s) a partir dos prazos pendentes.`
            : "Todos os prazos pendentes já tinham tarefa.",
      })

      await carregar()
    } catch {
      setAviso({ tipo: "erro", texto: "Não foi possível gerar as tarefas." })
    } finally {
      setGerando(false)
    }
  }

  /**
   * Depois de cadastrar feriados ou suspensões em
   * lib/domain/prazo/calendario.ts, isto põe as datas já guardadas —
   * e as tarefas delas — de acordo com o calendário novo.
   */
  async function recalcularPrazos() {
    setRecalculando(true)
    setAviso(null)
    try {
      const r = await fetch("/api/intimacoes/recalcular", { method: "POST" })
      const dados = await r.json()

      if (!r.ok) {
        setAviso({ tipo: "erro", texto: dados.error ?? "Falha ao recalcular" })
        return
      }

      setAviso({
        tipo: "ok",
        texto:
          dados.atualizadas > 0
            ? `${dados.atualizadas} prazo(s) recalculado(s) e ${dados.tarefasMovidas} tarefa(s) remarcada(s).`
            : "Todos os prazos já estavam de acordo com o calendário atual.",
      })

      await carregar()
    } catch {
      setAviso({ tipo: "erro", texto: "Não foi possível recalcular." })
    } finally {
      setRecalculando(false)
    }
  }

  async function criarTarefa(
    id: string,
    dados: { data: string; responsavelId: string | null; setor: TimeTarefa | null }
  ) {
    const r = await fetch(`/api/intimacoes/${id}/tarefa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    })

    if (!r.ok) return
    const { tarefa } = await r.json()

    setIntimacoes((atuais) =>
      atuais.map((i) => (i.id === id ? { ...i, tarefa_id: tarefa.id } : i))
    )
  }

  /**
   * Um clique põe a intimação no time: move a tarefa que já existe ou
   * cria uma nova já direcionada.
   */
  async function direcionar(intimacao: Intimacao, time: TimeTarefa) {
    if (intimacao.tarefa_id) {
      const r = await fetch(`/api/tarefas/${intimacao.tarefa_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setor: time }),
      })

      if (!r.ok) return

      setIntimacoes((atuais) =>
        atuais.map((i) =>
          i.id === intimacao.id
            ? { ...i, tarefa: { ...(i.tarefa ?? { id: intimacao.tarefa_id!, status: "PENDENTE" }), setor: time } }
            : i
        )
      )
      return
    }

    const r = await fetch(`/api/intimacoes/${intimacao.id}/tarefa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: intimacao.prazo_estimado ?? hojeISO(),
        setor: time,
      }),
    })

    if (!r.ok) return
    const { tarefa } = await r.json()

    setIntimacoes((atuais) =>
      atuais.map((i) =>
        i.id === intimacao.id
          ? {
              ...i,
              tarefa_id: tarefa.id,
              tarefa: { id: tarefa.id, setor: time, status: tarefa.status },
            }
          : i
      )
    )
  }

  async function analisar(id: string) {
    const r = await fetch("/api/intimacoes/analises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })

    const dados = await r.json()

    if (!r.ok) {
      setAviso({ tipo: "erro", texto: dados.error ?? "Não foi possível ler" })
      return
    }

    const atualizada = (dados.intimacoes ?? []).find(
      (i: { id: string }) => i.id === id
    )

    if (atualizada) {
      setIntimacoes((atuais) =>
        atuais.map((i) => (i.id === id ? { ...i, ...atualizada } : i))
      )
    }
  }

  async function analisarPendentes() {
    setAnalisandoLote(true)
    setAviso(null)
    try {
      const r = await fetch("/api/intimacoes/analises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limite: 30 }),
      })
      const dados = await r.json()

      if (!r.ok) {
        setAviso({ tipo: "erro", texto: dados.error ?? "Falha na leitura" })
        return
      }

      setAviso({
        tipo: "ok",
        texto:
          dados.analisadas > 0
            ? `${dados.analisadas} publicação(ões) lida(s) pela IA.` +
              (dados.falharam > 0 ? ` ${dados.falharam} falhou(aram).` : "")
            : "Nada novo para ler.",
      })

      await carregar()
    } catch {
      setAviso({ tipo: "erro", texto: "Não foi possível falar com a IA." })
    } finally {
      setAnalisandoLote(false)
    }
  }

  async function alternarTratada(id: string, tratada: boolean) {
    const r = await fetch(`/api/intimacoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tratada }),
    })

    if (!r.ok) return

    setIntimacoes((atuais) =>
      atuais.map((i) =>
        i.id === id
          ? { ...i, tratada_em: tratada ? new Date().toISOString() : null }
          : i
      )
    )
  }

  const pendentes = intimacoes.filter((i) => !i.tratada_em)

  const comPrazoVivo = pendentes.filter(
    (i) => i.prazo_estimado && i.prazo_estimado >= hojeISO()
  )

  const vencidas = pendentes.filter(
    (i) => i.prazo_estimado && i.prazo_estimado < hojeISO()
  )

  // Vencido entra em urgente: se passou e ninguém viu, é o primeiro
  // caso a olhar, não o último.
  const urgentes = useMemo(() => {
    const limite = emDias(DIAS_URGENTE)
    return pendentes.filter(
      (i) => i.prazo_estimado && i.prazo_estimado.slice(0, 10) <= limite
    )
  }, [pendentes])

  // Sem escolha manual, a tela abre onde dói: em urgente, se houver
  // algo lá. Abrir numa aba vazia seria pior que não ter a aba.
  const filtro: Filtro =
    filtroEscolhido ?? (urgentes.length > 0 ? "urgente" : "pendentes")

  const filtradas = useMemo(() => {
    const base =
      filtro === "todas"
        ? intimacoes
        : filtro === "urgente"
          ? urgentes
          : filtro === "prazo"
            ? pendentes.filter((i) => i.prazo_dias)
            : pendentes

    const termo = normalizar(busca.trim())

    const encontradas = !termo
      ? base
      : base.filter((i) => {
          const digitos = termo.replace(/\D/g, "")
          const numero = (i.numero_processo ?? "").replace(/\D/g, "")
          return (
            normalizar(i.destinatario ?? "").includes(termo) ||
            normalizar(i.nome_orgao ?? "").includes(termo) ||
            normalizar(i.texto).includes(termo) ||
            (digitos.length > 0 && numero.includes(digitos))
          )
        })

    return [...encontradas].sort(porPrazo)
  }, [intimacoes, pendentes, urgentes, filtro, busca])

  const semLeitura = pendentes.filter((i) => !i.ia_analisada_em).length

  const semTarefa = pendentes.filter(
    (i) => i.prazo_estimado && !i.tarefa_id
  ).length

  const abas: { chave: Filtro; rotulo: string; total: number; alerta?: boolean }[] =
    [
      {
        chave: "urgente",
        rotulo: "Urgente",
        total: urgentes.length,
        alerta: true,
      },
      { chave: "pendentes", rotulo: "Pendentes", total: pendentes.length },
      {
        chave: "prazo",
        rotulo: "Com prazo",
        total: pendentes.filter((i) => i.prazo_dias).length,
      },
      { chave: "todas", rotulo: "Todas", total: intimacoes.length },
    ]

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header
          title="Intimações"
          subtitle="Publicações do DJEN em nome da OAB do escritório"
        />
        <main className="flex-1 space-y-5 p-5 md:p-7">
          <AbasJudicial pendentes={pendentes.length} />

          <section className="overflow-hidden rounded-xl bg-card shadow-card">
            <span
              aria-hidden
              className="block h-1 w-full bg-gradient-to-r from-amber-500 via-red-600 to-violet-600"
            />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Bell size={24} strokeWidth={1.9} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-heading text-[17px] leading-tight font-semibold">
                  Diário de Justiça Eletrônico Nacional
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                  Uma busca cobre todos os tribunais em que a OAB atua. Cada
                  publicação com prazo já vira tarefa na data do vencimento —
                  data estimada em dias úteis com feriados nacionais, ainda sem
                  as suspensões de cada tribunal.
                </p>

                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-medium">
                  <input
                    type="checkbox"
                    checked={automatico}
                    onChange={(e) => alternarAutomatico(e.target.checked)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <Sparkles size={13} className="text-primary" />
                  Criar tarefa automaticamente para cada prazo encontrado
                </label>

                <RotinaAutomatica ultima={ultimaAutomatica} />

                {automatico && (
                  <label className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                    Entregar ao
                    <select
                      value={timePadrao}
                      onChange={(e) => definirTimePadrao(e.target.value)}
                      aria-label="Time que recebe as tarefas automáticas"
                      className="h-7 rounded-lg border border-input bg-card px-2 text-[12px] text-foreground outline-none"
                    >
                      <option value="">Sem time (caixa de entrada)</option>
                      {TIMES_TAREFA.map((t) => (
                        <option key={t} value={t}>
                          {TIME_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="flex shrink-0 items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                    OAB
                  </span>
                  <div className="flex gap-1">
                    <Input
                      value={oab.numero}
                      onChange={(e) =>
                        setOab((o) => ({ ...o, numero: e.target.value }))
                      }
                      aria-label="Número da OAB"
                      className="h-9 w-24 text-sm"
                    />
                    <Input
                      value={oab.uf}
                      onChange={(e) =>
                        setOab((o) => ({ ...o, uf: e.target.value.toUpperCase() }))
                      }
                      aria-label="UF da OAB"
                      maxLength={2}
                      className="h-9 w-14 text-center text-sm"
                    />
                  </div>
                </label>

                <Button onClick={buscarNoDjen} disabled={buscando} className="h-9">
                  {buscando ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <Download size={14} className="mr-1.5" />
                  )}
                  Buscar no DJEN
                </Button>

                <Button
                  variant="ghost"
                  onClick={recalcularPrazos}
                  disabled={recalculando}
                  title="Use depois de cadastrar feriados ou suspensões de tribunal"
                  className="h-9 px-2"
                >
                  {recalculando ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                </Button>
              </div>
            </div>

            {aviso && (
              <p
                className={cn(
                  "border-t px-5 py-2 text-[12.5px]",
                  aviso.tipo === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                )}
              >
                {aviso.texto}
              </p>
            )}
          </section>

          {semLeitura > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-accent/60 px-3.5 py-2.5 shadow-card">
              <SparklesIcon size={15} className="shrink-0 text-primary" />
              <p className="min-w-0 flex-1 text-[12.5px]">
                <span className="font-semibold">{semLeitura}</span> publicação(ões)
                sem leitura por IA. A leitura diz do que se trata, o que fazer e
                se o prazo é do escritório.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={analisarPendentes}
                disabled={analisandoLote}
                className="h-8"
              >
                {analisandoLote ? (
                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                ) : null}
                Ler {Math.min(semLeitura, 30)} com IA
              </Button>
            </div>
          )}

          {semTarefa > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-accent/60 px-3.5 py-2.5 shadow-card">
              <Wand2 size={15} className="shrink-0 text-primary" />
              <p className="min-w-0 flex-1 text-[12.5px]">
                <span className="font-semibold">{semTarefa}</span> prazo(s)
                pendente(s) ainda sem tarefa — de antes da criação automática.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={gerarPendentes}
                disabled={gerando}
                className="h-8"
              >
                {gerando ? (
                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                ) : null}
                Criar as {semTarefa} tarefas
              </Button>
            </div>
          )}

          {vencidas.length > 0 && (
            <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-[12.5px] font-medium text-red-800 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900">
              <AlertTriangle size={15} className="shrink-0" />
              {vencidas.length} intimação(ões) pendente(s) com prazo estimado já
              vencido. {comPrazoVivo.length} ainda no prazo.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg bg-muted p-0.5">
              {abas.map((aba) => (
                <button
                  key={aba.chave}
                  type="button"
                  onClick={() => setFiltroEscolhido(aba.chave)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    filtro === aba.chave
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {aba.rotulo}
                  <span
                    className={cn(
                      "ml-1.5 rounded px-1 tabular-nums",
                      // A contagem de urgente é a única que precisa
                      // gritar: as outras são navegação, esta é aviso.
                      aba.alerta && aba.total > 0
                        ? "bg-red-600 font-bold text-white"
                        : "opacity-70"
                    )}
                  >
                    {aba.total}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative max-w-xs flex-1">
              <Search
                size={15}
                strokeWidth={1.9}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por parte, órgão, número ou texto"
                aria-label="Buscar nas intimações"
                className="pl-9 text-sm"
              />
            </div>
          </div>

          {carregando ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Bell}
                  title={
                    intimacoes.length === 0
                      ? "Nenhuma intimação guardada"
                      : filtro === "urgente"
                        ? "Nenhum prazo apertado"
                        : "Nada neste filtro"
                  }
                  description={
                    intimacoes.length === 0
                      ? "Clique em “Buscar no DJEN” para trazer as publicações dos últimos 30 dias."
                      : filtro === "urgente"
                        ? `Nada vencendo em ${DIAS_URGENTE} dias ou menos entre as pendentes.`
                        : "Troque o filtro ou limpe a busca."
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {filtradas.map((i) => (
                <CartaoIntimacao
                  key={i.id}
                  intimacao={i}
                  usuarios={usuarios}
                  onCriarTarefa={(dados) => criarTarefa(i.id, dados)}
                  onAlternarTratada={(t) => alternarTratada(i.id, t)}
                  onDirecionar={(time) => direcionar(i, time)}
                  onAnalisar={() => analisar(i.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
