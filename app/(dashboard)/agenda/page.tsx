"use client"

import { useState, useEffect, useRef } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Plus, Trash2, Save, Pencil, CalendarDays } from "lucide-react"
import {
  TAREFA_STATUS_LABELS,
  TAREFA_STATUS_VALUES,
  TAREFA_PRIORIDADE_LABELS,
  TAREFA_PRIORIDADE_VALUES,
  type Tarefa,
  type Processo,
} from "@/lib/data"

const emptyForm = {
  titulo: "",
  descricao: "",
  data: "",
  hora: "",
  status: "PENDENTE" as const,
  prioridade: "MEDIA" as const,
  processoId: "",
}

function getStatusVariant(status: string) {
  if (status === "CONCLUIDA") return "default"
  if (status === "EM_ANDAMENTO") return "secondary"
  if (status === "CANCELADA") return "destructive"
  return "outline"
}

function getPrioridadeVariant(prioridade: string) {
  if (prioridade === "URGENTE") return "destructive"
  if (prioridade === "ALTA") return "default"
  if (prioridade === "MEDIA") return "secondary"
  return "outline"
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function AgendaPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [processos, setProcessos] = useState<Processo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Elemento que abriu o modal. O Dialog é controlado, então o base-ui não
  // descobre sozinho para onde devolver o foco — passamos via `finalFocus`.
  // Limitação: guardamos o nó DOM; se o item sair da lista, o foco cai no <body>.
  const abridorRef = useRef<HTMLElement | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const [tarefasRes, processosRes] = await Promise.all([
        fetch("/api/tarefas"),
        fetch("/api/processos"),
      ])

      const tarefasData = await tarefasRes.json()
      const processosData = await processosRes.json()

      if (tarefasRes.ok) setTarefas(tarefasData.tarefas)
      if (processosRes.ok) setProcessos(processosData.processos)
    } catch (err) {
      console.error("Erro ao carregar agenda:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  function openNewDialog(e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(tarefa: Tarefa, e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditingId(tarefa.id)
    setForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao || "",
      data: tarefa.data ? tarefa.data.slice(0, 10) : "",
      hora: tarefa.hora || "",
      status: tarefa.status as typeof emptyForm.status,
      prioridade: tarefa.prioridade as typeof emptyForm.prioridade,
      processoId: tarefa.processoId || "",
    })
    setDialogOpen(true)
  }

  async function salvarTarefa() {
    if (!form.titulo.trim() || !form.data) return

    const payload: Record<string, string> = {
      titulo: form.titulo,
      data: form.data,
      status: form.status,
      prioridade: form.prioridade,
    }
    if (form.descricao) payload.descricao = form.descricao
    if (form.hora) payload.hora = form.hora
    if (form.processoId) payload.processoId = form.processoId

    try {
      const response = await fetch(
        editingId ? `/api/tarefas/${editingId}` : "/api/tarefas",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      if (response.ok) {
        setDialogOpen(false)
        setForm(emptyForm)
        setEditingId(null)
        fetchData()
      }
    } catch (err) {
      console.error("Erro ao salvar tarefa:", err)
    }
  }

  async function deleteTarefa(id: string) {
    if (!confirm("Tem certeza que deseja excluir este compromisso?")) return
    try {
      await fetch(`/api/tarefas/${id}`, { method: "DELETE" })
      fetchData()
    } catch (err) {
      console.error("Erro ao excluir tarefa:", err)
    }
  }

  const hoje = hojeISO()
  const naoConcluidas = (t: Tarefa) => t.status !== "CONCLUIDA" && t.status !== "CANCELADA"

  const atrasadas = tarefas.filter((t) => t.data.slice(0, 10) < hoje && naoConcluidas(t))
  const deHoje = tarefas.filter((t) => t.data.slice(0, 10) === hoje)
  const proximas = tarefas.filter((t) => t.data.slice(0, 10) > hoje)
  const concluidasOuCanceladas = tarefas.filter(
    (t) => t.data.slice(0, 10) < hoje && !naoConcluidas(t)
  )

  function renderGrupo(titulo: string, itens: Tarefa[]) {
    if (itens.length === 0) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{titulo}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {itens.map((tarefa) => (
            <div
              key={tarefa.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{tarefa.titulo}</span>
                  <Badge variant={getStatusVariant(tarefa.status)}>
                    {TAREFA_STATUS_LABELS[tarefa.status]}
                  </Badge>
                  <Badge variant={getPrioridadeVariant(tarefa.prioridade)}>
                    {TAREFA_PRIORIDADE_LABELS[tarefa.prioridade]}
                  </Badge>
                </div>
                {tarefa.descricao && (
                  <p className="mt-1 text-sm text-muted-foreground">{tarefa.descricao}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {tarefa.data.slice(0, 10).split("-").reverse().join("/")}
                  {tarefa.hora ? ` às ${tarefa.hora}` : ""}
                </p>
              </div>
              <div className="flex gap-1 self-end sm:self-auto">
                <Button variant="ghost" size="sm" onClick={(e) => openEditDialog(tarefa, e)}>
                  <Pencil size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteTarefa(tarefa.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header title="Agenda" subtitle="Gerencie compromissos e prazos." />
        <main className="flex-1 space-y-4 p-5 md:p-7">
          <div className="mb-2 flex items-center justify-end">
            <Button onClick={openNewDialog}>
              <Plus size={16} />
              Novo Compromisso
            </Button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-lg" finalFocus={abridorRef}>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Editar compromisso" : "Novo compromisso"}
                </DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Atualize os dados do compromisso."
                    : "Agende um compromisso ou prazo do escritório."}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Título"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
                <Input
                  placeholder="Descrição"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
                <div className="flex gap-3">
                  <Input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                  />
                  <Input
                    type="time"
                    value={form.hora}
                    onChange={(e) => setForm({ ...form, hora: e.target.value })}
                  />
                </div>

                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as typeof emptyForm.status })
                  }
                  className="w-full h-9 rounded-lg border border-input bg-card px-3 text-[14px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
                >
                  {TAREFA_STATUS_VALUES.map((status) => (
                    <option key={status} value={status}>
                      {TAREFA_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>

                <select
                  value={form.prioridade}
                  onChange={(e) =>
                    setForm({ ...form, prioridade: e.target.value as typeof emptyForm.prioridade })
                  }
                  className="w-full h-9 rounded-lg border border-input bg-card px-3 text-[14px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
                >
                  {TAREFA_PRIORIDADE_VALUES.map((prioridade) => (
                    <option key={prioridade} value={prioridade}>
                      {TAREFA_PRIORIDADE_LABELS[prioridade]}
                    </option>
                  ))}
                </select>

                <select
                  value={form.processoId}
                  onChange={(e) => setForm({ ...form, processoId: e.target.value })}
                  className="w-full h-9 rounded-lg border border-input bg-card px-3 text-[14px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
                >
                  <option value="">Sem processo vinculado</option>
                  {processos.map((processo) => (
                    <option key={processo.id} value={processo.id}>
                      {processo.beneficio} {processo.numero ? `(${processo.numero})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
                <Button onClick={salvarTarefa}>
                  <Save size={16} />
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {loading ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ) : tarefas.length === 0 ? (
            <Card>
              <EmptyState
                icon={CalendarDays}
                title="Nenhum compromisso cadastrado"
                description='Clique em "Novo Compromisso" para começar.'
              />
            </Card>
          ) : (
            <>
              {renderGrupo("Atrasadas", atrasadas)}
              {renderGrupo("Hoje", deHoje)}
              {renderGrupo("Próximos", proximas)}
              {renderGrupo("Concluídas / Canceladas", concluidasOuCanceladas)}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
