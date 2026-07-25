"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Save } from "lucide-react"
import {
  PROCESSO_STATUS_LABELS,
  PROCESSO_STATUS_VALUES,
  type Processo,
  type Cliente,
  type User,
} from "@/lib/data"

export default function Processos() {
  const [processos, setProcessos] = useState<Processo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [novoProcesso, setNovoProcesso] = useState({
    clienteId: "",
    beneficio: "",
    numero: "",
    status: "EM_ANALISE",
    responsavelId: "",
    dataEntrada: "",
    observacoes: "",
  })

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
          observacoes: "",
        })
        fetchData()
      }
    } catch (err) {
      console.error("Erro ao salvar processo:", err)
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

  function getStatusVariant(status: string) {
    if (status === "CONCLUIDO" || status === "BENEFICIO_CONCEDIDO")
      return "default"
    if (status === "PERICIA_MARCADA" || status === "PERICIA_CONCLUIDA")
      return "secondary"
    if (status === "RECUSADO" || status === "ARQUIVADO") return "destructive"
    return "outline"
  }

  function getClienteNome(clienteId: string) {
    return clientes.find((c) => c.id === clienteId)?.nome || "—"
  }

  function getResponsavelNome(responsavelId?: string | null) {
    if (!responsavelId) return "—"
    return users.find((u) => u.id === responsavelId)?.name || "—"
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Processos</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de processos do escritório
          </p>
        </div>

        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={16} className="mr-2" />
          Novo Processo
        </Button>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader>
              <CardTitle>Novo Processo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <select
                value={novoProcesso.clienteId}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, clienteId: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base md:text-sm"
              >
                <option value="">Selecione um cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>

              <Input
                placeholder="Tipo de benefício"
                value={novoProcesso.beneficio}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, beneficio: e.target.value })
                }
              />
              <Input
                placeholder="Número do processo"
                value={novoProcesso.numero}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, numero: e.target.value })
                }
              />

              <select
                value={novoProcesso.status}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, status: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base md:text-sm"
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
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base md:text-sm"
              >
                <option value="">Sem responsável</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>

              <Input
                placeholder="Data de entrada"
                type="date"
                value={novoProcesso.dataEntrada}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, dataEntrada: e.target.value })
                }
              />
              <Input
                placeholder="Observações"
                value={novoProcesso.observacoes}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, observacoes: e.target.value })
                }
              />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={salvarProcesso}>
                  <Save size={16} className="mr-2" />
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Carregando processos...
              </p>
            </div>
          ) : processos.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum processo cadastrado. Clique em "Novo Processo" para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
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
                    <tr key={processo.id} className="border-t border-zinc-200 dark:border-zinc-800">
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
                        <Badge variant={getStatusVariant(processo.status)}>
                          {PROCESSO_STATUS_LABELS[processo.status] || processo.status}
                        </Badge>
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
          )}
        </CardContent>
      </Card>
    </main>
  )
}
