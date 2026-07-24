"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Save } from "lucide-react"

type Cliente = {
  id: string
  nome: string
  cpf: string | null
  telefone: string | null
  beneficio: string | null
  processos: Processo[]
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

export default function ClienteDetalhe() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [novoProcesso, setNovoProcesso] = useState({
    beneficio: "",
    numero: "",
    status: "Em análise",
    responsavel: "",
    data: "",
    observacoes: "",
  })

  async function fetchCliente() {
    setLoading(true)
    try {
      const response = await fetch(`/api/clientes/${id}`)
      const data = await response.json()
      if (response.ok) {
        setCliente(data.cliente)
      } else {
        router.push("/clientes")
      }
    } catch (err) {
      console.error("Erro ao carregar cliente:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCliente()
  }, [id])

  async function salvarProcesso() {
    try {
      const response = await fetch("/api/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...novoProcesso, clienteId: id }),
      })

      if (response.ok) {
        setNovoProcesso({
          beneficio: "",
          numero: "",
          status: "Em análise",
          responsavel: "",
          data: "",
          observacoes: "",
        })
        fetchCliente()
      }
    } catch (err) {
      console.error("Erro ao salvar processo:", err)
    }
  }

  async function deleteProcesso(processoId: string) {
    if (!confirm("Tem certeza que deseja excluir este processo?")) return
    try {
      await fetch(`/api/processos/${processoId}`, { method: "DELETE" })
      fetchCliente()
    } catch (err) {
      console.error("Erro ao excluir processo:", err)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-100 p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    )
  }

  if (!cliente) {
    return (
      <main className="min-h-screen bg-zinc-100 p-6">
        <p className="text-sm text-muted-foreground">Cliente não encontrado</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{cliente.nome}</h1>
        <p className="text-sm text-muted-foreground">Detalhes do cliente</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>CPF: {cliente.cpf || "—"}</p>
            <p>Telefone: {cliente.telefone || "—"}</p>
            <p>Benefício: {cliente.beneficio || "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cliente.processos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum processo cadastrado.
              </p>
            ) : (
              cliente.processos.map((processo) => (
                <div
                  key={processo.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{processo.beneficio}</p>
                      <p className="text-sm">
                        Status:{" "}
                        <Badge variant="outline" className="text-xs">
                          {processo.status}
                        </Badge>
                      </p>
                      {processo.responsavel && (
                        <p className="text-sm">
                          Responsável: {processo.responsavel}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteProcesso(processo.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Novo Processo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
          <Button onClick={salvarProcesso}>
            <Save size={16} className="mr-2" />
            Salvar Processo
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
