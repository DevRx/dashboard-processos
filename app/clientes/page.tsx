"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const initialClientes = [
  { id: 1, nome: "Ana Souza", cpf: "123.456.789-00", telefone: "(11) 99999-1111", beneficio: "INSS" },
  { id: 2, nome: "Carlos Mendes", cpf: "987.654.321-00", telefone: "(11) 98888-2222", beneficio: "Aposentadoria" },
]

export default function ClientesPage() {
  const [clientes, setClientes] = useState(initialClientes)
  const [nome, setNome] = useState("")
  const [cpf, setCpf] = useState("")
  const [telefone, setTelefone] = useState("")
  const [beneficio, setBeneficio] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return

    setClientes((prev) => [
      ...prev,
      {
        id: Date.now(),
        nome,
        cpf,
        telefone,
        beneficio,
      },
    ])

    setNome("")
    setCpf("")
    setTelefone("")
    setBeneficio("")
  }

  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">Cadastro e gestão dos clientes do escritório.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader>
                <CardTitle>Novo cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
                  <Input placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
                  <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                  <Input placeholder="Benefício" value={beneficio} onChange={(e) => setBeneficio(e.target.value)} />
                  <Button type="submit" className="w-full">Salvar cliente</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader>
                <CardTitle>Lista de clientes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left dark:bg-zinc-800">
                      <tr>
                        <th className="p-3">Nome</th>
                        <th className="p-3">CPF</th>
                        <th className="p-3">Telefone</th>
                        <th className="p-3">Benefício</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((cliente) => (
                        <tr key={cliente.id} className="border-t border-zinc-200 dark:border-zinc-800">
                          <td className="p-3">{cliente.nome}</td>
                          <td className="p-3">{cliente.cpf}</td>
                          <td className="p-3">{cliente.telefone}</td>
                          <td className="p-3">{cliente.beneficio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
