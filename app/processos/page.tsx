"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Save } from "lucide-react"

type Cliente = {
  id: string
  nome: string
}

type Processo = {
  id: string
  clienteId: string
  beneficio: string
  numero: string | null
  status: string
  responsavel: string | null
  data: string | null
  observacoes: string | null
  createdAt: string
  updatedAt: string
}

export default function Processos() {
  const [processos, setProcessos] = useState<Processo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [novoProcesso, setNovoProcesso] = useState({
    clienteId: "",
    beneficio: "",
    numero: "",
    status: "Em análise",
    responsavel: "",
    data: "",
    observacoes: "",
  })

  async function fetchData() {
    setLoading(true)
    try {
      const [processosRes, clientesRes] = await Promise.all([
        fetch("/api/processos"),
        fetch("/api/clientes"),
      ])

      const processosData = await processosRes.json()
      const clientesData = await clientesRes.json()

      if (processosRes.ok) setProcessos(processosData.processos)
      if (clientesRes.ok) setClientes(clientesData.clientes)
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
          status: "Em análise",
          responsavel: "",
          data: "",
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
    if (status === "Concluído" || status === "Benefício concedido")
      return "default"
    if (status.includes("Perícia")) return "secondary"
    return "outline"
  }

  function getClienteNome(clienteId: string) {
    return clientes.find((c) => c.id === clienteId)?.nome || "—"
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-6">
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
          <Card className="w-full max-w-2xl">
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
              <Input
                placeholder="Status"
                value={novoProcesso.status}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, status: e.target.value })
                }
              />
              <Input
                placeholder="Responsável"
                value={novoProcesso.responsavel}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, responsavel: e.target.value })
                }
              />
              <Input
                placeholder="Data de entrada"
                type="date"
                value={novoProcesso.data}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, data: e.target.value })
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

      <Card>
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
            <table className="w-full">
              <thead className="bg-zinc-50">
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
                  <tr key={processo.id} className="border-t">
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
                        {processo.status}
                      </Badge>
                    </td>
                    <td className="p-4">{processo.responsavel || "—"}</td>
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
          )}
        </CardContent>
      </Card>
    </main>
  )
}
