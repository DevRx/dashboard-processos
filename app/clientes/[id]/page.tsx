"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Save } from "lucide-react"
import {
  PROCESSO_STATUS_LABELS,
  PROCESSO_STATUS_VALUES,
  type Cliente,
  type Processo,
  type User,
} from "@/lib/data"

export default function ClienteDetalhe() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [novoProcesso, setNovoProcesso] = useState({
    beneficio: "",
    numero: "",
    status: "EM_ANALISE",
    responsavelId: "",
    dataEntrada: "",
    observacoes: "",
  })

  async function fetchCliente() {
    setLoading(true)
    try {
      const [clienteRes, usersRes] = await Promise.all([
        fetch(`/api/clientes/${id}`),
        fetch("/api/users"),
      ])

      const clienteData = await clienteRes.json()
      const usersData = await usersRes.json()

      if (clienteRes.ok) {
        setCliente(clienteData.cliente)
      } else {
        router.push("/clientes")
      }
      if (usersRes.ok) setUsers(usersData.users)
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
          status: "EM_ANALISE",
          responsavelId: "",
          dataEntrada: "",
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

  function getResponsavelNome(responsavelId?: string | null) {
    if (!responsavelId) return "—"
    return users.find((u) => u.id === responsavelId)?.name || "—"
  }

  const processos = cliente?.processos || []

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
            <p>E-mail: {cliente.email || "—"}</p>
            <p>Telefone: {cliente.telefone || "—"}</p>
            <p>Endereço: {cliente.endereco || "—"}</p>
            <p>Data de nascimento: {cliente.dataNascimento || "—"}</p>
            <p>Benefício: {cliente.beneficio || "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum processo cadastrado.
              </p>
            ) : (
              processos.map((processo: Processo) => (
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
                          {PROCESSO_STATUS_LABELS[processo.status] || processo.status}
                        </Badge>
                      </p>
                      {processo.numero && (
                        <p className="text-sm">Número: {processo.numero}</p>
                      )}
                      {processo.responsavelId && (
                        <p className="text-sm">
                          Responsável: {getResponsavelNome(processo.responsavelId)}
                        </p>
                      )}
                      {processo.dataEntrada && (
                        <p className="text-sm">
                          Data de entrada: {processo.dataEntrada}
                        </p>
                      )}
                      {processo.observacoes && (
                        <p className="text-sm">
                          Observações: {processo.observacoes}
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
          <Button onClick={salvarProcesso}>
            <Save size={16} className="mr-2" />
            Salvar Processo
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
