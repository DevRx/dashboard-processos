"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Edit } from "lucide-react"

type Cliente = {
  id: string
  nome: string
  cpf: string | null
  telefone: string | null
  beneficio: string | null
  createdAt: string
  updatedAt: string
}

export default function Clientes() {
  const [clientesLista, setClientesLista] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [novoCliente, setNovoCliente] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    beneficio: "",
  })

  async function fetchClientes() {
    setLoading(true)
    try {
      const response = await fetch("/api/clientes")
      const data = await response.json()
      if (response.ok) {
        setClientesLista(data.clientes)
      }
    } catch (err) {
      console.error("Erro ao carregar clientes:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClientes()
  }, [])

  async function salvarCliente() {
    try {
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novoCliente),
      })

      if (response.ok) {
        setDialogOpen(false)
        setNovoCliente({ nome: "", cpf: "", telefone: "", beneficio: "" })
        fetchClientes()
      }
    } catch (err) {
      console.error("Erro ao salvar cliente:", err)
    }
  }

  async function deleteCliente(id: string) {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return
    try {
      await fetch(`/api/clientes/${id}`, { method: "DELETE" })
      fetchClientes()
    } catch (err) {
      console.error("Erro ao excluir cliente:", err)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de clientes do escritório
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button>
              <Plus size={16} className="mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <Input
                placeholder="Nome completo"
                value={novoCliente.nome}
                onChange={(e) =>
                  setNovoCliente({ ...novoCliente, nome: e.target.value })
                }
              />
              <Input
                placeholder="CPF"
                value={novoCliente.cpf}
                onChange={(e) =>
                  setNovoCliente({ ...novoCliente, cpf: e.target.value })
                }
              />
              <Input
                placeholder="Telefone"
                value={novoCliente.telefone}
                onChange={(e) =>
                  setNovoCliente({ ...novoCliente, telefone: e.target.value })
                }
              />
              <Input
                placeholder="Benefício desejado"
                value={novoCliente.beneficio}
                onChange={(e) =>
                  setNovoCliente({ ...novoCliente, beneficio: e.target.value })
                }
              />
              <Button onClick={salvarCliente}>Salvar Cliente</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Carregando clientes...
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="p-4 text-left">Nome</th>
                  <th className="p-4 text-left">CPF</th>
                  <th className="p-4 text-left">Telefone</th>
                  <th className="p-4 text-left">Benefício</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientesLista.map((cliente) => (
                  <tr key={cliente.id} className="border-t">
                    <td className="p-4">
                      <Link
                        href={`/clientes/${cliente.id}`}
                        className="font-medium hover:underline"
                      >
                        {cliente.nome}
                      </Link>
                    </td>
                    <td className="p-4">{cliente.cpf || "—"}</td>
                    <td className="p-4">{cliente.telefone || "—"}</td>
                    <td className="p-4">{cliente.beneficio || "—"}</td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCliente(cliente.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && clientesLista.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum cliente cadastrado. Clique em "Novo Cliente" para começar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
