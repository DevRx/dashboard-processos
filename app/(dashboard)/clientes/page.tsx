"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
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
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Plus, Trash2, Save, Pencil, Users } from "lucide-react"
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

  // Elemento que abriu o modal ("Novo Cliente" ou o lápis de uma linha).
  // O Dialog é controlado, então o base-ui não descobre sozinho para onde
  // devolver o foco ao fechar — passamos via `finalFocus`.
  //
  // Limitação conhecida: guardamos o nó DOM, não uma identidade estável. Se a
  // linha sair da lista enquanto o modal está aberto (exclusão, filtro), o nó
  // fica órfão e o foco cai no <body>. Aceito por ora: não é regressão, já que
  // antes da migração não havia retorno de foco nenhum.
  const abridorRef = useRef<HTMLElement | null>(null)

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

  function openNewDialog(e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(cliente: Cliente, e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
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
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header title="Clientes" subtitle="Cadastro e gestão dos clientes do escritório." />
        <main className="flex-1 p-5 md:p-7">
          <div className="mb-6 flex items-center justify-end">
            <Button onClick={openNewDialog}>
              <Plus size={16} />
              Novo Cliente
            </Button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-lg" finalFocus={abridorRef}>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar cliente" : "Novo cliente"}</DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Atualize os dados cadastrais do cliente."
                    : "Preencha os dados para cadastrar um novo cliente."}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-3">
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
              </div>

              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
                <Button onClick={salvarCliente}>
                  <Save size={16} />
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle>Lista de clientes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : clientes.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nenhum cliente cadastrado"
                  description='Clique em "Novo Cliente" para começar.'
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
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
                        <tr key={cliente.id} className="border-t border-border/70 transition-colors hover:bg-muted/40">
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
                              <Button variant="ghost" size="sm" onClick={(e) => openEditDialog(cliente, e)}>
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
