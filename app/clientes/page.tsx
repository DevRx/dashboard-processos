"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Save, Pencil } from "lucide-react"
import type { Cliente } from "@/lib/data"

const emptyForm = {
  nome: "",
  cpf: "",
  email: "",
  telefone: "",
  endereco: "",
  dataNascimento: "",
  beneficio: "",
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  async function fetchClientes() {
    setLoading(true)
    try {
      const res = await fetch("/api/clientes")
      const data = await res.json()
      if (res.ok) setClientes(data.clientes)
    } catch (err) {
      console.error("Erro ao carregar clientes:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClientes()
  }, [])

  function openNewDialog() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(cliente: Cliente) {
    setEditingId(cliente.id)
    setForm({
      nome: cliente.nome,
      cpf: cliente.cpf || "",
      email: cliente.email || "",
      telefone: cliente.telefone || "",
      endereco: cliente.endereco || "",
      dataNascimento: cliente.dataNascimento || "",
      beneficio: cliente.beneficio || "",
    })
    setDialogOpen(true)
  }

  async function salvarCliente() {
    if (!form.nome.trim()) return

    const payload: Record<string, string> = { nome: form.nome }
    if (form.cpf) payload.cpf = form.cpf
    if (form.email) payload.email = form.email
    if (form.telefone) payload.telefone = form.telefone
    if (form.endereco) payload.endereco = form.endereco
    if (form.dataNascimento) payload.dataNascimento = form.dataNascimento
    if (form.beneficio) payload.beneficio = form.beneficio

    try {
      const response = await fetch(
        editingId ? `/api/clientes/${editingId}` : "/api/clientes",
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
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Clientes</h1>
              <p className="text-sm text-muted-foreground">
                Cadastro e gestão dos clientes do escritório.
              </p>
            </div>
            <Button onClick={openNewDialog}>
              <Plus size={16} className="mr-2" />
              Novo Cliente
            </Button>
          </div>

          {dialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <Card className="w-full max-w-lg border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <CardHeader>
                  <CardTitle>{editingId ? "Editar cliente" : "Novo cliente"}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Input
                    placeholder="Nome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                  <Input
                    placeholder="CPF"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  />
                  <Input
                    placeholder="E-mail"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  <Input
                    placeholder="Telefone"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                  <Input
                    placeholder="Endereço"
                    value={form.endereco}
                    onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  />
                  <Input
                    placeholder="Data de nascimento"
                    type="date"
                    value={form.dataNascimento}
                    onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
                  />
                  <Input
                    placeholder="Benefício"
                    value={form.beneficio}
                    onChange={(e) => setForm({ ...form, beneficio: e.target.value })}
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={salvarCliente}>
                      <Save size={16} className="mr-2" />
                      Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader>
              <CardTitle>Lista de clientes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">Carregando clientes...</p>
                </div>
              ) : clientes.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum cliente cadastrado. Clique em &quot;Novo Cliente&quot; para começar.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left dark:bg-zinc-800">
                      <tr>
                        <th className="p-3">Nome</th>
                        <th className="p-3">CPF</th>
                        <th className="p-3">Telefone</th>
                        <th className="p-3">Benefício</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((cliente) => (
                        <tr key={cliente.id} className="border-t border-zinc-200 dark:border-zinc-800">
                          <td className="p-3">
                            <Link href={`/clientes/${cliente.id}`} className="font-medium hover:underline">
                              {cliente.nome}
                            </Link>
                          </td>
                          <td className="p-3">{cliente.cpf || "—"}</td>
                          <td className="p-3">{cliente.telefone || "—"}</td>
                          <td className="p-3">{cliente.beneficio || "—"}</td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(cliente)}>
                                <Pencil size={16} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteCliente(cliente.id)}>
                                <Trash2 size={16} />
                              </Button>
                            </div>
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
      </div>
    </div>
  )
}
