"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Save,
  Sunrise,
  Trash2,
  type LucideIcon,
} from "lucide-react"

import { Pagina } from "@/components/layout/pagina"
import { Badge, type BadgeVariant } from "@/components/ui/badge"
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
import { EmptyState } from "@/components/dashboard/empty-state"
import { formatarData, hojeISO, partesData, prazoRelativo } from "@/lib/formatar"
import { cn } from "@/lib/utils"
import {
  TAREFA_STATUS_LABELS,
  TAREFA_STATUS_VALUES,
  TAREFA_PRIORIDADE_LABELS,
  type Tarefa,
  type TarefaPrioridade,
  type TarefaStatus,
  type Processo,
} from "@/lib/data"

const VAZIO = {
  titulo: "",
  descricao: "",
  data: "",
  hora: "",
  status: "PENDENTE" as TarefaStatus,
  prioridade: "MEDIA" as TarefaPrioridade,
  processoId: "",
}

const TOM_STATUS: Record<TarefaStatus, BadgeVariant> = {
  PENDENTE: "outline",
  EM_ANDAMENTO: "info",
  CONCLUIDA: "success",
  CANCELADA: "muted",
}

const TOM_PRIORIDADE: Record<TarefaPrioridade, BadgeVariant> = {
  URGENTE: "danger",
  ALTA: "warning",
  MEDIA: "muted",
  BAIXA: "muted",
}

type Grupo = {
  chave: "atrasadas" | "hoje" | "proximas" | "encerradas"
  titulo: string
  descricao: string
  icone: LucideIcon
  cor: string
  bloco: string
}

/**
 * Os grupos são a leitura da tela: o que passou (vermelho), o que é
 * hoje (a cor da marca) e o que vem depois. O bloco de data de cada
 * item repete a cor do grupo, para o olho não precisar do título.
 */
const GRUPOS: Grupo[] = [
  {
    chave: "atrasadas",
    titulo: "Atrasados",
    descricao: "Passaram da data e ainda não foram concluídos",
    icone: AlertTriangle,
    cor: "text-status-danger-foreground",
    bloco: "bg-status-danger text-status-danger-foreground",
  },
  {
    chave: "hoje",
    titulo: "Hoje",
    descricao: "O que precisa acontecer ainda hoje",
    icone: Sunrise,
    cor: "text-brand",
    bloco: "bg-brand text-white",
  },
  {
    chave: "proximas",
    titulo: "Próximos dias",
    descricao: "Compromissos e prazos que vêm por aí",
    icone: CalendarDays,
    cor: "text-status-info-foreground",
    bloco: "bg-status-info text-status-info-foreground",
  },
  {
    chave: "encerradas",
    titulo: "Concluídos e cancelados",
    descricao: "O que já ficou para trás",
    icone: CheckCircle2,
    cor: "text-muted-foreground",
    bloco: "bg-muted text-muted-foreground",
  },
]

function encerrada(t: Tarefa) {
  return t.status === "CONCLUIDA" || t.status === "CANCELADA"
}

export default function AgendaPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [processos, setProcessos] = useState<Processo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [concluindo, setConcluindo] = useState<string | null>(null)
  const { confirmar, dialogo: dialogoConfirmacao } = useConfirmacao()

  // Elemento que abriu o modal. O Dialog é controlado, então o base-ui não
  // descobre sozinho para onde devolver o foco — passamos via `finalFocus`.
  const abridorRef = useRef<HTMLElement | null>(null)

  const fetchData = useCallback(() => {
    const json = (r: Response) => (r.ok ? r.json() : null)
    return Promise.all([fetch("/api/tarefas").then(json), fetch("/api/processos").then(json)])
      .then(([tarefasData, processosData]) => {
        if (tarefasData) setTarefas(tarefasData.tarefas)
        if (processosData) setProcessos(processosData.processos)
      })
      .catch((err) => console.error("Erro ao carregar agenda:", err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function abrirNovo(e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditingId(null)
    setForm({ ...VAZIO, data: hojeISO() })
    setErro(null)
    setDialogOpen(true)
  }

  function abrirEdicao(tarefa: Tarefa, e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditingId(tarefa.id)
    setForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao || "",
      data: tarefa.data ? tarefa.data.slice(0, 10) : "",
      hora: tarefa.hora || "",
      status: tarefa.status,
      prioridade: tarefa.prioridade,
      processoId: tarefa.processoId || "",
    })
    setErro(null)
    setDialogOpen(true)
  }

  function payloadDe(t: typeof VAZIO) {
    const payload: Record<string, string> = {
      titulo: t.titulo,
      data: t.data,
      status: t.status,
      prioridade: t.prioridade,
    }
    if (t.descricao) payload.descricao = t.descricao
    if (t.hora) payload.hora = t.hora
    if (t.processoId) payload.processoId = t.processoId
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

  async function concluir(tarefa: Tarefa) {
    setConcluindo(tarefa.id)
    try {
      const r = await fetch(`/api/tarefas/${tarefa.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          payloadDe({
            titulo: tarefa.titulo,
            descricao: tarefa.descricao || "",
            data: tarefa.data.slice(0, 10),
            hora: tarefa.hora || "",
            status: "CONCLUIDA",
            prioridade: tarefa.prioridade,
            processoId: tarefa.processoId || "",
          })
        ),
      })
      if (r.ok) {
        setTarefas((atuais) =>
          atuais.map((t) => (t.id === tarefa.id ? { ...t, status: "CONCLUIDA" } : t))
        )
      }
    } finally {
      setConcluindo(null)
    }
  }

  async function excluir(tarefa: Tarefa) {
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

  const processoPorId = useMemo(
    () => new Map(processos.map((p) => [p.id, p])),
    [processos]
  )

  const grupos = useMemo(() => {
    const hoje = hojeISO()
    const porData = (a: Tarefa, b: Tarefa) =>
      `${a.data.slice(0, 10)} ${a.hora ?? ""}`.localeCompare(
        `${b.data.slice(0, 10)} ${b.hora ?? ""}`
      )

    return {
      atrasadas: tarefas.filter((t) => t.data.slice(0, 10) < hoje && !encerrada(t)).sort(porData),
      hoje: tarefas.filter((t) => t.data.slice(0, 10) === hoje && !encerrada(t)).sort(porData),
      proximas: tarefas.filter((t) => t.data.slice(0, 10) > hoje && !encerrada(t)).sort(porData),
      encerradas: tarefas.filter(encerrada).sort((a, b) => porData(b, a)),
    }
  }, [tarefas])

  const botaoNovo = (
    <Button onClick={abrirNovo}>
      <CalendarPlus size={16} />
      Novo compromisso
    </Button>
  )

  function Item({ tarefa, grupo }: { tarefa: Tarefa; grupo: Grupo }) {
    const { dia, mes } = partesData(tarefa.data)
    const processo = tarefa.processoId ? processoPorId.get(tarefa.processoId) : null
    const fechada = encerrada(tarefa)

    return (
      <li
        className={cn(
          "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:items-center",
          fechada && "opacity-70"
        )}
      >
        <span
          className={cn(
            "flex w-12 shrink-0 flex-col items-center justify-center rounded-lg py-1.5 leading-none",
            grupo.bloco
          )}
          title={formatarData(tarefa.data)}
        >
          <span className="font-heading text-lg font-semibold tabular-nums">{dia}</span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-wide uppercase">{mes}</span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "text-[14px] font-semibold",
                tarefa.status === "CONCLUIDA" && "line-through decoration-muted-foreground/60"
              )}
            >
              {tarefa.titulo}
            </span>
            {tarefa.prioridade !== "MEDIA" && tarefa.prioridade !== "BAIXA" && (
              <Badge variant={TOM_PRIORIDADE[tarefa.prioridade]}>
                {TAREFA_PRIORIDADE_LABELS[tarefa.prioridade]}
              </Badge>
            )}
            {tarefa.status !== "PENDENTE" && (
              <Badge variant={TOM_STATUS[tarefa.status]}>
                {TAREFA_STATUS_LABELS[tarefa.status]}
              </Badge>
            )}
          </div>

          {tarefa.descricao && (
            <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted-foreground">
              {tarefa.descricao}
            </p>
          )}

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {tarefa.hora ? `às ${tarefa.hora}` : "sem hora marcada"}
              {!fechada && (
                <span className={cn("ml-1", grupo.chave === "atrasadas" && "font-medium text-status-danger-foreground")}>
                  · {prazoRelativo(tarefa.data)}
                </span>
              )}
            </span>
            {processo && (
              <span className="truncate">
                {processo.beneficio}
                {processo.numero ? ` · ${processo.numero}` : ""}
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {!fechada && (
            <Button
              variant="soft"
              size="sm"
              title="Marcar como concluído"
              onClick={() => concluir(tarefa)}
              disabled={concluindo === tarefa.id}
              className="text-status-success-foreground hover:bg-status-success"
            >
              {concluindo === tarefa.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} strokeWidth={2.5} />
              )}
              <span className="hidden md:inline">Concluir</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Editar"
            aria-label={`Editar ${tarefa.titulo}`}
            onClick={(e) => abrirEdicao(tarefa, e)}
          >
            <Pencil size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Excluir"
            aria-label={`Excluir ${tarefa.titulo}`}
            className="text-muted-foreground hover:bg-status-danger hover:text-status-danger-foreground"
            onClick={() => excluir(tarefa)}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </li>
    )
  }

  return (
    <Pagina
      titulo="Agenda"
      subtitulo="Compromissos e prazos do escritório"
      acoes={botaoNovo}
    >
      {!loading && tarefas.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {GRUPOS.filter((g) => g.chave !== "encerradas").map((g) => {
            const Icone = g.icone
            const total = grupos[g.chave].length
            return (
              <a
                key={g.chave}
                href={`#agenda-${g.chave}`}
                className="flex items-center gap-2.5 rounded-xl bg-card px-3 py-3 shadow-card transition-shadow hover:shadow-md sm:gap-3 sm:px-4"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", g.bloco)}>
                  <Icone size={18} strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="font-heading block text-xl leading-none font-semibold tabular-nums">
                    {total}
                  </span>
                  <span className="block text-[11px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
                    {g.titulo}
                  </span>
                </span>
              </a>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : tarefas.length === 0 ? (
        <section className="rounded-xl bg-card shadow-card">
          <EmptyState
            icon={CalendarDays}
            title="A agenda está vazia"
            description="Marque o primeiro compromisso ou prazo. Ele aparece aqui separado em atrasados, hoje e próximos."
            acao={botaoNovo}
          />
        </section>
      ) : (
        GRUPOS.map((grupo) => {
          const itens = grupos[grupo.chave]
          const Icone = grupo.icone
          if (itens.length === 0 && grupo.chave !== "hoje") return null

          const cabecalho = (
            <div className="flex items-center gap-3 px-4 py-3">
              <Icone size={18} strokeWidth={2} className={cn("shrink-0", grupo.cor)} />
              <div className="min-w-0 flex-1">
                <h2 className={cn("font-heading text-[15px] leading-tight font-semibold", grupo.cor)}>
                  {grupo.titulo}
                </h2>
                <p className="text-[12px] text-muted-foreground">{grupo.descricao}</p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-semibold tabular-nums">
                {itens.length}
              </span>
            </div>
          )

          if (grupo.chave === "encerradas") {
            return (
              <details
                key={grupo.chave}
                id={`agenda-${grupo.chave}`}
                className="group overflow-hidden rounded-xl bg-card shadow-card"
              >
                <summary className="cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                  {cabecalho}
                </summary>
                <ul className="divide-y divide-border border-t border-border">
                  {itens.map((t) => (
                    <Item key={t.id} tarefa={t} grupo={grupo} />
                  ))}
                </ul>
              </details>
            )
          }

          return (
            <section
              key={grupo.chave}
              id={`agenda-${grupo.chave}`}
              className="scroll-mt-20 overflow-hidden rounded-xl bg-card shadow-card"
            >
              {cabecalho}
              {itens.length === 0 ? (
                <p className="border-t border-border px-4 py-5 text-center text-[13px] text-muted-foreground">
                  Nada marcado para hoje. Bom dia de trabalho!
                </p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {itens.map((t) => (
                    <Item key={t.id} tarefa={t} grupo={grupo} />
                  ))}
                </ul>
              )}
            </section>
          )
        })
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
