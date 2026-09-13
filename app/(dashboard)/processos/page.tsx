"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Plus, Trash2, Save, Search, Loader2, LayoutGrid, List, FolderSearch } from "lucide-react"
import {
  PROCESSO_STATUS_LABELS,
  PROCESSO_STATUS_VALUES,
  type Processo,
  type Cliente,
  type User,
} from "@/lib/data"
import { KanbanBoard } from "@/components/processos/kanban-board"

export default function Processos() {
  const [processos, setProcessos] = useState<Processo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [visao, setVisao] = useState<"lista" | "board">("board")
  const [novoProcesso, setNovoProcesso] = useState({
    clienteId: "",
    beneficio: "",
    numero: "",
    status: "EM_ANALISE",
    responsavelId: "",
    dataEntrada: "",
    prazo: "",
    tribunal: "",
    vara: "",
    observacoes: "",
  })
  const [buscandoDataJud, setBuscandoDataJud] = useState(false)
  const [dataJudMsg, setDataJudMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null)

  // Elemento que abriu o modal. O Dialog é controlado, então o base-ui não
  // descobre sozinho para onde devolver o foco — passamos via `finalFocus`.
  // Limitação: guardamos o nó DOM; se ele sair da árvore, o foco cai no <body>.
  const abridorRef = useRef<HTMLElement | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const [processosRes, clientesRes, usersRes] = await Promise.all([
        fetch("/api/processos"),
        fetch("/api/clientes"),
        fetch("/api/users"),
      ])

      const processosData = await processosRes.json()
      const clientesData = await clientesRes.json()
      const usersData = await usersRes.json()

      if (processosRes.ok) setProcessos(processosData.processos)
      if (clientesRes.ok) setClientes(clientesData.clientes)
      if (usersRes.ok) setUsers(usersData.users)
    } catch (err) {
      console.error("Erro ao carregar dados:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function salvarProcesso() {
    try {
      const response = await fetch("/api/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novoProcesso),
      })

      if (response.ok) {
        setDialogOpen(false)
        setNovoProcesso({
          clienteId: "",
          beneficio: "",
          numero: "",
          status: "EM_ANALISE",
          responsavelId: "",
          dataEntrada: "",
          prazo: "",
          tribunal: "",
          vara: "",
          observacoes: "",
        })
        setDataJudMsg(null)
        fetchData()
      }
    } catch (err) {
      console.error("Erro ao salvar processo:", err)
    }
  }

  async function buscarNoDataJud() {
    if (!novoProcesso.numero.trim()) return
    setBuscandoDataJud(true)
    setDataJudMsg(null)
    try {
      const res = await fetch(
        `/api/processos/lookup?numero=${encodeURIComponent(novoProcesso.numero)}`
      )
      const data = await res.json()

      if (!res.ok) {
        setDataJudMsg({ tipo: "erro", texto: data.error || "Erro ao buscar processo" })
        return
      }

      const d = data.dados
      const infoExtra = [
        d.classe ? `Classe: ${d.classe}` : null,
        d.ultimoMovimento
          ? `Último movimento: ${d.ultimoMovimento.nome}${d.ultimoMovimento.data ? ` (${d.ultimoMovimento.data.slice(0, 10).split("-").reverse().join("/")})` : ""}`
          : null,
      ]
        .filter(Boolean)
        .join(" — ")

      setNovoProcesso((prev) => ({
        ...prev,
        beneficio: d.assuntos?.[0] || prev.beneficio,
        dataEntrada: d.dataAjuizamento ? d.dataAjuizamento.slice(0, 10) : prev.dataEntrada,
        tribunal: d.tribunal || prev.tribunal,
        vara: d.orgaoJulgador || prev.vara,
        observacoes: infoExtra
          ? [prev.observacoes, infoExtra].filter(Boolean).join(" | ")
          : prev.observacoes,
      }))
      setDataJudMsg({ tipo: "ok", texto: "Dados encontrados e preenchidos. Confira o cliente e o benefício antes de salvar." })
    } catch (err) {
      console.error("Erro ao buscar no DataJud:", err)
      setDataJudMsg({ tipo: "erro", texto: "Erro de conexão ao buscar o processo" })
    } finally {
      setBuscandoDataJud(false)
    }
  }

  async function deleteProcesso(id: string) {
    if (!confirm("Tem certeza que deseja excluir este processo?")) return
    try {
      await fetch(`/api/processos/${id}`, { method: "DELETE" })
      fetchData()
    } catch (err) {
      console.error("Erro ao excluir processo:", err)
    }
  }

  function getClienteNome(clienteId: string) {
    return clientes.find((c) => c.id === clienteId)?.nome || "—"
  }

  function getResponsavelNome(responsavelId?: string | null) {
    if (!responsavelId) return "—"
    return users.find((u) => u.id === responsavelId)?.name || "—"
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header title="Processos" subtitle="Gestão de processos do escritório" />
        <main className="flex-1 p-5 md:p-7">
      <div className="mb-6 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-1">
            <Button
              variant={visao === "board" ? "default" : "ghost"}
              size="sm"
              onClick={() => setVisao("board")}
            >
              <LayoutGrid size={16} />
              Board
            </Button>
            <Button
              variant={visao === "lista" ? "default" : "ghost"}
              size="sm"
              onClick={() => setVisao("lista")}
            >
              <List size={16} />
              Lista
            </Button>
          </div>
          <Button
            onClick={(e) => {
              abridorRef.current = e.currentTarget
              setDialogOpen(true)
            }}
          >
            <Plus size={16} />
            Novo Processo
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl" finalFocus={abridorRef}>
          <DialogHeader>
            <DialogTitle>Novo Processo</DialogTitle>
            <DialogDescription>
              Informe o número CNJ e use a busca para preencher os dados automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
              <select
                value={novoProcesso.clienteId}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, clienteId: e.target.value })
                }
                className="w-full h-9 rounded-lg border border-input bg-card px-3 text-[14px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
              >
                <option value="">Selecione um cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <Input
                  placeholder="Número do processo (CNJ)"
                  value={novoProcesso.numero}
                  onChange={(e) =>
                    setNovoProcesso({ ...novoProcesso, numero: e.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={buscarNoDataJud}
                  disabled={buscandoDataJud || !novoProcesso.numero.trim()}
                >
                  {buscandoDataJud ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                </Button>
              </div>
              {dataJudMsg && (
                <p
                  className={
                    dataJudMsg.tipo === "erro"
                      ? "text-sm text-destructive"
                      : "text-sm text-emerald-600 dark:text-emerald-400"
                  }
                >
                  {dataJudMsg.texto}
                </p>
              )}

              <Input
                placeholder="Tipo de benefício"
                value={novoProcesso.beneficio}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, beneficio: e.target.value })
                }
              />

              <select
                value={novoProcesso.status}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, status: e.target.value })
                }
                className="w-full h-9 rounded-lg border border-input bg-card px-3 text-[14px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
              >
                {PROCESSO_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {PROCESSO_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>

              <select
                value={novoProcesso.responsavelId}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, responsavelId: e.target.value })
                }
                className="w-full h-9 rounded-lg border border-input bg-card px-3 text-[14px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
              >
                <option value="">Sem responsável</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <Input
                  placeholder="Data de entrada"
                  type="date"
                  value={novoProcesso.dataEntrada}
                  onChange={(e) =>
                    setNovoProcesso({ ...novoProcesso, dataEntrada: e.target.value })
                  }
                />
                <Input
                  placeholder="Prazo"
                  type="date"
                  value={novoProcesso.prazo}
                  onChange={(e) =>
                    setNovoProcesso({ ...novoProcesso, prazo: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Tribunal (ex: TRF3)"
                  value={novoProcesso.tribunal}
                  onChange={(e) =>
                    setNovoProcesso({ ...novoProcesso, tribunal: e.target.value })
                  }
                />
                <Input
                  placeholder="Vara / órgão julgador"
                  value={novoProcesso.vara}
                  onChange={(e) =>
                    setNovoProcesso({ ...novoProcesso, vara: e.target.value })
                  }
                />
              </div>
              <Input
                placeholder="Observações"
                value={novoProcesso.observacoes}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, observacoes: e.target.value })
                }
              />

          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button onClick={salvarProcesso}>
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
      ) : processos.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderSearch}
            title="Nenhum processo cadastrado"
            description='Clique em "Novo Processo" para começar.'
          />
        </Card>
      ) : visao === "board" ? (
        <KanbanBoard
          processos={processos}
          clientes={clientes}
          users={users}
          onUpdated={fetchData}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  <tr>
                    <th className="p-4 text-left">Cliente</th>
                    <th className="p-4 text-left">Benefício</th>
                    <th className="p-4 text-left">Número</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Responsável</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {processos.map((processo) => (
                    <tr key={processo.id} className="border-t border-border/70 transition-colors hover:bg-muted/40">
                      <td className="p-4">
                        <Link
                          href={`/clientes/${processo.clienteId}`}
                          className="font-medium hover:underline"
                        >
                          {getClienteNome(processo.clienteId)}
                        </Link>
                      </td>
                      <td className="p-4">{processo.beneficio}</td>
                      <td className="p-4">{processo.numero || "—"}</td>
                      <td className="p-4">
                        <StatusBadge status={processo.status} />
                      </td>
                      <td className="p-4">
                        {getResponsavelNome(processo.responsavelId)}
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProcesso(processo.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
        </main>
      </div>
    </div>
  )
}
