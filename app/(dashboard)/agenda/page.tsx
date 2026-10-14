"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  Flame,
  Loader2,
  Pencil,
  Save,
  Scale,
  Trash2,
  UserRound,
} from "lucide-react"

import { concluirMinhaParte } from "@/components/tarefas/usar-tarefas"
import { Pagina } from "@/components/layout/pagina"
import { Button } from "@/components/ui/button"
import { Campo, LinhaCampos } from "@/components/ui/campo"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Segmentado } from "@/components/ui/segmentado"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useConfirmacao } from "@/components/ui/confirmacao"
import { CalendarioMes } from "@/components/agenda/calendario-mes"
import { CORES_CATEGORIA } from "@/components/agenda/cores-agenda"
import { CORES_TIME, paletaDe } from "@/components/tarefas/cores-time"
import { formatarDataLonga, prazoRelativo } from "@/lib/formatar"
import { cn } from "@/lib/utils"
import { ALERTA } from "@/components/ui/alerta"
import {
  CATEGORIAS_AGENDA,
  CATEGORIA_AGENDA_LABEL,
  TIMES_TAREFA,
  TIME_LABEL,
  categoriaNaAgenda,
  isTimeTarefa,
  rotuloDaCor,
  type CategoriaAgenda,
  type TimeTarefa,
} from "@/lib/domain/tarefa"
import {
  TAREFA_STATUS_LABELS,
  TAREFA_STATUS_VALUES,
  type TarefaPrioridade,
  type TarefaStatus,
  type Processo,
} from "@/lib/data"

/**
 * Agenda do escritório.
 *
 * À esquerda, dois calendários, um embaixo do outro: o geral, com toda
 * tarefa em aberto na cor do time, e o de perícias e prazos, onde a cor
 * é o tipo — prazo do DJEN em vermelho, perícia em amarelo,
 * exigência em verde. À direita, à parte, as urgentes, com filtro por
 * cor e por período.
 *
 * Só as tarefas em aberto descem do servidor: as concluídas são
 * milhares (o histórico do TickTick) e nenhuma delas é compromisso.
 */

type TarefaAgenda = {
  id: string
  titulo: string
  descricao?: string | null
  data: string
  hora?: string | null
  status: TarefaStatus
  prioridade: TarefaPrioridade
  processoId?: string | null
  setor?: string | null
  pasta?: string | null
  tipo?: string | null
  deIntimacao?: boolean
  responsavel?: { id: string; name: string } | null
}

type Periodo = "DIA" | "SEMANA" | "MES" | "TODOS"
type FiltroCor = "TODAS" | TimeTarefa

const VAZIO = {
  titulo: "",
  descricao: "",
  data: "",
  hora: "",
  status: "PENDENTE" as TarefaStatus,
  prioridade: "MEDIA" as TarefaPrioridade,
  processoId: "",
  setor: "" as "" | TimeTarefa,
}

/** Hoje no relógio de quem olha — não em UTC, que vira o dia às 21h. */
function hojeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function somarDias(iso: string, dias: number) {
  const [a, m, d] = iso.split("-").map(Number)
  const r = new Date(Date.UTC(a, m - 1, d + dias))
  return r.toISOString().slice(0, 10)
}

function diaDe(t: TarefaAgenda) {
  return t.data.slice(0, 10)
}

function porDataHora(a: TarefaAgenda, b: TarefaAgenda) {
  return `${diaDe(a)} ${a.hora ?? ""}`.localeCompare(`${diaDe(b)} ${b.hora ?? ""}`)
}

/** Ordem dos times na tela; sem time fica por último. */
function ordemDoTime(setor?: string | null) {
  const i = TIMES_TAREFA.indexOf(setor as TimeTarefa)
  return i === -1 ? TIMES_TAREFA.length : i
}

const PERIODOS: { valor: Periodo; rotulo: string; dica: string }[] = [
  { valor: "DIA", rotulo: "Dia", dica: "até hoje" },
  { valor: "SEMANA", rotulo: "Semana", dica: "próximos 7 dias" },
  { valor: "MES", rotulo: "Mês", dica: "próximos 30 dias" },
  { valor: "TODOS", rotulo: "Todos", dica: "sem limite de data" },
]

/** O que as linhas da agenda podem fazer com a tarefa. */
type AcoesTarefa = {
  concluindo: string | null
  onConcluir: (t: TarefaAgenda) => void
  onEditar: (t: TarefaAgenda, e: React.MouseEvent<HTMLButtonElement>) => void
  onExcluir: (t: TarefaAgenda) => void
}

function Acoes({ tarefa, acoes }: { tarefa: TarefaAgenda; acoes: AcoesTarefa }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        variant="soft"
        size="icon-sm"
        title="Marcar como concluído"
        aria-label={`Concluir ${tarefa.titulo}`}
        onClick={() => acoes.onConcluir(tarefa)}
        disabled={acoes.concluindo === tarefa.id}
        className="text-status-success-foreground hover:bg-status-success"
      >
        {acoes.concluindo === tarefa.id ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Check size={14} strokeWidth={2.5} />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Editar"
        aria-label={`Editar ${tarefa.titulo}`}
        onClick={(e) => acoes.onEditar(tarefa, e)}
      >
        <Pencil size={14} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Excluir"
        aria-label={`Excluir ${tarefa.titulo}`}
        className="text-muted-foreground hover:bg-status-danger hover:text-status-danger-foreground"
        onClick={() => acoes.onExcluir(tarefa)}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

/** Uma linha de tarefa: a faixa à esquerda diz a cor que importa ali. */
function Linha({
  tarefa,
  categoria,
  mostrarData,
  hoje,
  processo,
  acoes,
}: {
  tarefa: TarefaAgenda
  /** No calendário de perícias e prazos, a cor é o tipo — não o time. */
  categoria?: CategoriaAgenda
  mostrarData?: boolean
  hoje: string
  processo?: Processo | null
  acoes: AcoesTarefa
}) {
  const paleta = paletaDe(tarefa.setor)
  const atrasada = diaDe(tarefa) < hoje

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border-l-4 px-3 py-2.5",
        categoria
          ? cn("bg-muted/40", CORES_CATEGORIA[categoria].faixa)
          : paleta
            ? cn(paleta.cartao, paleta.borda)
            : "border-l-muted-foreground/30 bg-muted/40"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {categoria ? (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                CORES_CATEGORIA[categoria].etiqueta
              )}
            >
              {CATEGORIA_AGENDA_LABEL[categoria]}
            </span>
          ) : null}
          <span className="text-[13.5px] leading-snug font-semibold">{tarefa.titulo}</span>
        </div>

        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock size={11} />
            {mostrarData ? (
              <span className={cn(atrasada && cn("font-semibold", ALERTA.atrasadaTexto))}>
                {atrasada ? "atrasada · " : ""}
                {prazoRelativo(tarefa.data)}
              </span>
            ) : null}
            {tarefa.hora ? `${mostrarData ? " · " : ""}às ${tarefa.hora}` : mostrarData ? "" : "sem hora"}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={cn("size-2 rounded-full", paleta?.ponto ?? "bg-muted-foreground/40")} />
            {rotuloDaCor(tarefa.setor) ?? "sem time"}
          </span>
          {tarefa.responsavel ? (
            <span className="inline-flex items-center gap-1">
              <UserRound size={11} />
              {tarefa.responsavel.name}
            </span>
          ) : null}
          {processo ? (
            <span className="truncate">
              {processo.beneficio}
              {processo.numero ? ` · ${processo.numero}` : ""}
            </span>
          ) : null}
        </p>
      </div>
      <Acoes tarefa={tarefa} acoes={acoes} />
    </li>
  )
}

/** O dia escolhido no calendário, por extenso, com o que há nele. */
function DetalheDoDia({
  data,
  hoje,
  vazio,
  total,
  children,
}: {
  data: string
  hoje: string
  vazio: string
  total: number
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-border px-4 py-3">
      <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
        <span className="inline-block first-letter:uppercase">{formatarDataLonga(data)}</span>
        {data === hoje ? (
          <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background uppercase">
            hoje
          </span>
        ) : null}
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums">
          {total}
        </span>
      </h3>
      {total === 0 ? (
        <p className="py-3 text-center text-[12.5px] text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1">{children}</ul>
      )}
    </div>
  )
}

export default function AgendaPage() {
  const [tarefas, setTarefas] = useState<TarefaAgenda[]>([])
  const [processos, setProcessos] = useState<Processo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [setorOriginal, setSetorOriginal] = useState<string>("")
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [concluindo, setConcluindo] = useState<string | null>(null)
  const { confirmar, dialogo: dialogoConfirmacao } = useConfirmacao()

  const [hoje] = useState(hojeLocal)
  const [diaGeral, setDiaGeral] = useState(hoje)
  const [diaEspecial, setDiaEspecial] = useState(hoje)
  const [filtroCor, setFiltroCor] = useState<FiltroCor>("TODAS")
  const [periodo, setPeriodo] = useState<Periodo>("SEMANA")

  // Elemento que abriu o modal. O Dialog é controlado, então o base-ui não
  // descobre sozinho para onde devolver o foco — passamos via `finalFocus`.
  const abridorRef = useRef<HTMLElement | null>(null)

  const fetchData = useCallback(() => {
    const json = (r: Response) => (r.ok ? r.json() : null)
    return Promise.all([
      fetch("/api/tarefas?abertas=1&vinculos=1").then(json),
      fetch("/api/processos").then(json),
    ])
      .then(([tarefasData, processosData]) => {
        if (tarefasData) setTarefas(tarefasData.tarefas ?? [])
        if (processosData) setProcessos(processosData.processos ?? [])
      })
      .catch((err) => console.error("Erro ao carregar agenda:", err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── recortes ──────────────────────────────────────────────────────

  const abertas = useMemo(
    () => tarefas.filter((t) => t.status !== "CONCLUIDA" && t.status !== "CANCELADA"),
    [tarefas]
  )

  const geralPorDia = useMemo(() => {
    const mapa = new Map<string, TarefaAgenda[]>()
    for (const t of abertas) {
      const d = diaDe(t)
      mapa.set(d, [...(mapa.get(d) ?? []), t])
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => ordemDoTime(a.setor) - ordemDoTime(b.setor) || porDataHora(a, b))
    }
    return mapa
  }, [abertas])

  const especialPorDia = useMemo(() => {
    const mapa = new Map<string, { tarefa: TarefaAgenda; categoria: CategoriaAgenda }[]>()
    for (const t of abertas) {
      const categoria = categoriaNaAgenda(t)
      if (!categoria) continue
      const d = diaDe(t)
      mapa.set(d, [...(mapa.get(d) ?? []), { tarefa: t, categoria }])
    }
    for (const lista of mapa.values()) {
      lista.sort(
        (a, b) =>
          CATEGORIAS_AGENDA.indexOf(a.categoria) - CATEGORIAS_AGENDA.indexOf(b.categoria) ||
          porDataHora(a.tarefa, b.tarefa)
      )
    }
    return mapa
  }, [abertas])

  const urgentes = useMemo(() => {
    const limite =
      periodo === "DIA"
        ? hoje
        : periodo === "SEMANA"
          ? somarDias(hoje, 6)
          : periodo === "MES"
            ? somarDias(hoje, 30)
            : null

    return abertas
      .filter((t) => t.prioridade === "URGENTE")
      .filter((t) => filtroCor === "TODAS" || t.setor === filtroCor)
      .filter((t) => limite === null || diaDe(t) <= limite)
      .sort(porDataHora)
  }, [abertas, filtroCor, periodo, hoje])

  /** Quantas urgentes cada cor tem no período — o número no filtro. */
  const urgentesPorCor = useMemo(() => {
    const limite =
      periodo === "DIA" ? hoje : periodo === "SEMANA" ? somarDias(hoje, 6) : periodo === "MES" ? somarDias(hoje, 30) : null
    const conta = new Map<string, number>()
    for (const t of abertas) {
      if (t.prioridade !== "URGENTE") continue
      if (limite !== null && diaDe(t) > limite) continue
      conta.set("TODAS", (conta.get("TODAS") ?? 0) + 1)
      if (t.setor) conta.set(t.setor, (conta.get(t.setor) ?? 0) + 1)
    }
    return conta
  }, [abertas, periodo, hoje])

  const processoPorId = useMemo(
    () => new Map(processos.map((p) => [p.id, p])),
    [processos]
  )

  // ── ações ─────────────────────────────────────────────────────────

  function abrirNovo(e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditingId(null)
    setSetorOriginal("")
    setForm({ ...VAZIO, data: diaGeral || hoje })
    setErro(null)
    setDialogOpen(true)
  }

  function abrirEdicao(tarefa: TarefaAgenda, e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditingId(tarefa.id)
    const setor = isTimeTarefa(tarefa.setor) ? tarefa.setor : ""
    setSetorOriginal(setor)
    setForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao || "",
      data: diaDe(tarefa),
      hora: tarefa.hora || "",
      status: tarefa.status,
      prioridade: tarefa.prioridade,
      processoId: tarefa.processoId || "",
      setor,
    })
    setErro(null)
    setDialogOpen(true)
  }

  function payloadDe(t: typeof VAZIO) {
    const payload: Record<string, string | null> = {
      titulo: t.titulo,
      data: t.data,
      status: t.status,
      prioridade: t.prioridade,
    }
    if (t.descricao) payload.descricao = t.descricao
    if (t.hora) payload.hora = t.hora
    if (t.processoId) payload.processoId = t.processoId
    // O time só vai quando mudou: tarefa ainda gravada numa cor antiga
    // (preto, verde) não pode ser regravada sem querer.
    if (t.setor !== setorOriginal) payload.setor = t.setor || null
    return payload
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) return setErro("Dê um nome ao compromisso.")
    if (!form.data) return setErro("Escolha a data.")

    setSalvando(true)
    setErro(null)
    try {
      const response = await fetch(editingId ? `/api/tarefas/${editingId}` : "/api/tarefas", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadDe(form)),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setErro(data.error || "Não foi possível salvar. Tente de novo.")
        return
      }
      setDialogOpen(false)
      fetchData()
    } catch {
      setErro("Sem conexão. Verifique a internet e tente de novo.")
    } finally {
      setSalvando(false)
    }
  }

  /**
   * Concluir pela agenda fecha só a parte de quem clicou: se a tarefa
   * tem outros responsáveis no fluxo, ela continua na agenda deles (e
   * na de todo mundo, até a última parte). A lista vem de novo do
   * servidor para mostrar como ficou.
   */
  async function concluir(tarefa: TarefaAgenda) {
    setConcluindo(tarefa.id)
    try {
      const r = await concluirMinhaParte(tarefa.id)
      if (!r.ok) window.alert(r.erro)
      fetchData()
    } finally {
      setConcluindo(null)
    }
  }

  async function excluir(tarefa: TarefaAgenda) {
    const ok = await confirmar({
      titulo: `Excluir "${tarefa.titulo}"?`,
      descricao: "O compromisso some da agenda de todo mundo. Isso não pode ser desfeito.",
      rotuloConfirmar: "Excluir compromisso",
    })
    if (!ok) return
    try {
      await fetch(`/api/tarefas/${tarefa.id}`, { method: "DELETE" })
      fetchData()
    } catch (err) {
      console.error("Erro ao excluir tarefa:", err)
    }
  }

  // ── peças ─────────────────────────────────────────────────────────

  const botaoNovo = (
    <Button onClick={abrirNovo}>
      <CalendarPlus size={16} />
      Novo compromisso
    </Button>
  )

  const acoes: AcoesTarefa = {
    concluindo,
    onConcluir: concluir,
    onEditar: abrirEdicao,
    onExcluir: excluir,
  }

  const linha = (t: TarefaAgenda, extra?: { categoria?: CategoriaAgenda; mostrarData?: boolean }) => (
    <Linha
      key={t.id}
      tarefa={t}
      categoria={extra?.categoria}
      mostrarData={extra?.mostrarData}
      hoje={hoje}
      processo={t.processoId ? processoPorId.get(t.processoId) : null}
      acoes={acoes}
    />
  )

  // ── tela ──────────────────────────────────────────────────────────

  const legendaTimes = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
      {TIMES_TAREFA.map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", CORES_TIME[t].ponto)} />
          {TIME_LABEL[t]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-muted-foreground/40" />
        Sem time
      </span>
    </div>
  )

  const legendaCategorias = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
      {CATEGORIAS_AGENDA.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", CORES_CATEGORIA[c].ponto)} />
          {c === "PERICIA" ? "Perícias" : c === "PRAZO" ? "Prazos do DJEN" : "Exigências"}
        </span>
      ))}
    </div>
  )

  const listaGeralDoDia = geralPorDia.get(diaGeral) ?? []
  const listaEspecialDoDia = especialPorDia.get(diaEspecial) ?? []
  const dicaPeriodo = PERIODOS.find((p) => p.valor === periodo)?.dica

  return (
    <Pagina titulo="Agenda" subtitulo="Tarefas, perícias e prazos do escritório" acoes={botaoNovo}>
      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Skeleton className="h-[420px] w-full" />
            <Skeleton className="h-[420px] w-full" />
          </div>
          <Skeleton className="h-[520px] w-full" />
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Os dois calendários, um embaixo do outro, à esquerda. */}
          <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-none">
            <CalendarioMes
              titulo="Tarefas"
              subtitulo="Calendário geral — toda tarefa em aberto, na cor do time"
              icone={CalendarDays}
              legenda={legendaTimes}
              hoje={hoje}
              selecionado={diaGeral}
              onSelecionar={setDiaGeral}
              totalDoDia={(d) => geralPorDia.get(d)?.length ?? 0}
              conteudoDoDia={(d) => {
                const lista = geralPorDia.get(d) ?? []
                const conta = new Map<string, number>()
                for (const t of lista) {
                  const chave = isTimeTarefa(t.setor) ? t.setor : "SEM"
                  conta.set(chave, (conta.get(chave) ?? 0) + 1)
                }
                return (
                  <span className="flex flex-wrap gap-0.5">
                    {[...TIMES_TAREFA, "SEM" as const].map((chave) => {
                      const n = conta.get(chave)
                      if (!n) return null
                      return (
                        <span
                          key={chave}
                          title={`${chave === "SEM" ? "Sem time" : TIME_LABEL[chave]}: ${n}`}
                          className={cn(
                            "flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] leading-none font-bold tabular-nums sm:h-[18px] sm:min-w-[18px] sm:text-[10.5px]",
                            chave === "SEM"
                              ? "bg-muted-foreground/25 text-foreground/80"
                              : CORES_TIME[chave].cabecalho
                          )}
                        >
                          {n}
                        </span>
                      )
                    })}
                  </span>
                )
              }}
            >
              <DetalheDoDia
                data={diaGeral}
                hoje={hoje}
                total={listaGeralDoDia.length}
                vazio="Nenhuma tarefa em aberto neste dia."
              >
                {listaGeralDoDia.map((t) => linha(t))}
              </DetalheDoDia>
            </CalendarioMes>

            <CalendarioMes
              titulo="Perícias e prazos"
              subtitulo="Perícias, prazos do DJEN e exigências, cada um com a sua cor"
              icone={Scale}
              legenda={legendaCategorias}
              hoje={hoje}
              selecionado={diaEspecial}
              onSelecionar={setDiaEspecial}
              totalDoDia={(d) => especialPorDia.get(d)?.length ?? 0}
              conteudoDoDia={(d) => {
                const lista = especialPorDia.get(d) ?? []
                return (
                  <>
                    <span className="hidden flex-col gap-0.5 sm:flex">
                      {lista.slice(0, 2).map(({ tarefa, categoria }) => (
                        <span
                          key={tarefa.id}
                          title={`${CATEGORIA_AGENDA_LABEL[categoria]}: ${tarefa.titulo}`}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[10px] leading-tight font-semibold",
                            CORES_CATEGORIA[categoria].etiqueta
                          )}
                        >
                          {tarefa.titulo}
                        </span>
                      ))}
                      {lista.length > 2 ? (
                        <span className="px-1 text-[10px] font-semibold text-muted-foreground">
                          +{lista.length - 2}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap gap-0.5 sm:hidden">
                      {lista.slice(0, 6).map(({ tarefa, categoria }) => (
                        <span
                          key={tarefa.id}
                          className={cn("size-2 rounded-full", CORES_CATEGORIA[categoria].ponto)}
                        />
                      ))}
                    </span>
                  </>
                )
              }}
            >
              <DetalheDoDia
                data={diaEspecial}
                hoje={hoje}
                total={listaEspecialDoDia.length}
                vazio="Nenhuma perícia, prazo ou exigência neste dia."
              >
                {listaEspecialDoDia.map(({ tarefa, categoria }) => linha(tarefa, { categoria }))}
              </DetalheDoDia>
            </CalendarioMes>
          </div>

          {/* As urgentes, separadas, à direita. No celular sobem para o
              topo: são o que não pode esperar a rolagem. */}
          <aside className="order-1 flex flex-col overflow-hidden rounded-2xl bg-card shadow-card lg:sticky lg:top-20 lg:order-none lg:max-h-[calc(100vh-6rem)]">
            <header className="space-y-3 border-b border-border px-4 pt-4 pb-3">
              <div className="flex items-center gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ALERTA.urgente)}>
                  <Flame size={18} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-[15px] leading-tight font-semibold">
                    Tarefas urgentes
                  </h2>
                  <p className="text-[12px] text-muted-foreground">
                    Prioridade urgente · {dicaPeriodo}, atrasadas incluídas
                  </p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[13px] font-bold tabular-nums", ALERTA.urgente)}>
                  {urgentes.length}
                </span>
              </div>

              <Segmentado
                cheio
                tamanho="sm"
                valor={periodo}
                onChange={setPeriodo}
                aria-label="Período"
                opcoes={PERIODOS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))}
              />

              <div role="radiogroup" aria-label="Filtrar por cor" className="flex flex-wrap gap-1.5">
                {(["TODAS", ...TIMES_TAREFA] as FiltroCor[]).map((cor) => {
                  const ativo = filtroCor === cor
                  const n = urgentesPorCor.get(cor) ?? 0
                  return (
                    <button
                      key={cor}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => setFiltroCor(cor)}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold ring-1 transition-colors",
                        ativo
                          ? cor === "TODAS"
                            ? "bg-foreground text-background ring-foreground"
                            : cn(CORES_TIME[cor].cabecalho, "ring-transparent")
                          : "bg-card text-muted-foreground ring-border hover:bg-muted"
                      )}
                    >
                      {cor !== "TODAS" && !ativo ? (
                        <span className={cn("size-2.5 rounded-full", CORES_TIME[cor].ponto)} />
                      ) : null}
                      {cor === "TODAS" ? "Todas" : TIME_LABEL[cor]}
                      <span className="tabular-nums opacity-75">{n}</span>
                    </button>
                  )
                })}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {urgentes.length === 0 ? (
                <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">
                  Nenhuma tarefa urgente
                  {filtroCor !== "TODAS" ? ` no ${TIME_LABEL[filtroCor]}` : ""} nesse período.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {urgentes.map((t) => linha(t, { mostrarData: true }))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" finalFocus={abridorRef}>
          <form onSubmit={salvar} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Ajuste o que mudou."
                  : "Um prazo, uma audiência, uma perícia ou qualquer coisa com dia marcado."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <Campo rotulo="O que é" obrigatorio>
                <Input
                  autoFocus
                  placeholder="Ex.: Perícia da Maria no INSS"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  required
                />
              </Campo>

              <LinhaCampos>
                <Campo rotulo="Data" obrigatorio>
                  <Input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                    required
                  />
                </Campo>
                <Campo rotulo="Hora" dica="Opcional">
                  <Input
                    type="time"
                    value={form.hora}
                    onChange={(e) => setForm({ ...form, hora: e.target.value })}
                  />
                </Campo>
              </LinhaCampos>

              <Campo rotulo="Prioridade" grupo>
                <Segmentado
                  cheio
                  valor={form.prioridade}
                  onChange={(prioridade) => setForm({ ...form, prioridade })}
                  aria-label="Prioridade"
                  opcoes={[
                    { valor: "BAIXA", rotulo: "Baixa" },
                    { valor: "MEDIA", rotulo: "Média" },
                    { valor: "ALTA", rotulo: "Alta", tom: "alerta" },
                    { valor: "URGENTE", rotulo: "Urgente", tom: "perigo" },
                  ]}
                />
              </Campo>

              <Campo rotulo="Time" dica="A cor com que aparece na agenda e no quadro">
                <Select
                  value={form.setor}
                  onChange={(e) => setForm({ ...form, setor: e.target.value as "" | TimeTarefa })}
                >
                  <option value="">Sem time</option>
                  {TIMES_TAREFA.map((t) => (
                    <option key={t} value={t}>
                      {TIME_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </Campo>

              {editingId && (
                <Campo rotulo="Situação">
                  <Select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as TarefaStatus })}
                  >
                    {TAREFA_STATUS_VALUES.map((status) => (
                      <option key={status} value={status}>
                        {TAREFA_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                </Campo>
              )}

              <Campo rotulo="Caso relacionado" dica="Opcional — liga o compromisso a um processo">
                <Select
                  value={form.processoId}
                  onChange={(e) => setForm({ ...form, processoId: e.target.value })}
                >
                  <option value="">Nenhum</option>
                  {processos.map((processo) => (
                    <option key={processo.id} value={processo.id}>
                      {processo.beneficio} {processo.numero ? `(${processo.numero})` : ""}
                    </option>
                  ))}
                </Select>
              </Campo>

              <Campo rotulo="Detalhes">
                <Textarea
                  placeholder="Endereço, documentos para levar, quem acompanha…"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </Campo>
            </div>

            {erro && (
              <p role="alert" className="rounded-lg bg-status-danger px-3 py-2 text-[13px] text-status-danger-foreground">
                {erro}
              </p>
            )}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
              <Button type="submit" disabled={salvando}>
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? "Salvar alterações" : "Marcar na agenda"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {dialogoConfirmacao}
    </Pagina>
  )
}
