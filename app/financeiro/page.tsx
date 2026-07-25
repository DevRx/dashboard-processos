"use client"

import { useState, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MetricCard } from "@/components/dashboard/metric-card"
import { Plus, Trash2, Save, Pencil } from "lucide-react"
import {
  LANCAMENTO_TIPO_LABELS,
  LANCAMENTO_TIPO_VALUES,
  type LancamentoFinanceiro,
} from "@/lib/data"

const emptyForm = {
  descricao: "",
  valor: "",
  tipo: "ENTRADA" as const,
  data: "",
}

function formatBRL(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  async function fetchLancamentos() {
    setLoading(true)
    try {
      const res = await fetch("/api/financeiro")
      const data = await res.json()
      if (res.ok) setLancamentos(data.lancamentos)
    } catch (err) {
      console.error("Erro ao carregar financeiro:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLancamentos()
  }, [])

  const resumo = useMemo(() => {
    const entradas = lancamentos
      .filter((l) => l.tipo === "ENTRADA")
      .reduce((acc, l) => acc + Number(l.valor), 0)
    const saidas = lancamentos
      .filter((l) => l.tipo === "SAIDA")
      .reduce((acc, l) => acc + Number(l.valor), 0)
    return { entradas, saidas, saldo: entradas - saidas }
  }, [lancamentos])

  function openNewDialog() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(lancamento: LancamentoFinanceiro) {
    setEditingId(lancamento.id)
    setForm({
      descricao: lancamento.descricao,
      valor: String(lancamento.valor),
      tipo: lancamento.tipo as typeof emptyForm.tipo,
      data: lancamento.data ? lancamento.data.slice(0, 10) : "",
    })
    setDialogOpen(true)
  }

  async function salvarLancamento() {
    const valorNumero = parseFloat(form.valor.replace(",", "."))
    if (!form.descricao.trim() || !form.data || !valorNumero || valorNumero <= 0) return

    const payload = {
      descricao: form.descricao,
      valor: valorNumero,
      tipo: form.tipo,
      data: form.data,
    }

    try {
      const response = await fetch(
        editingId ? `/api/financeiro/${editingId}` : "/api/financeiro",
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
        fetchLancamentos()
      }
    } catch (err) {
      console.error("Erro ao salvar lançamento:", err)
    }
  }

  async function deleteLancamento(id: string) {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return
    try {
      await fetch(`/api/financeiro/${id}`, { method: "DELETE" })
      fetchLancamentos()
    } catch (err) {
      console.error("Erro ao excluir lançamento:", err)
    }
  }

  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 space-y-6 p-6">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                Controle simples de entradas e saídas.
              </p>
            </div>
            <Button onClick={openNewDialog}>
              <Plus size={16} className="mr-2" />
              Novo Lançamento
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              title="Total de entradas"
              value={formatBRL(resumo.entradas)}
              description="Somatório de lançamentos de entrada"
            />
            <MetricCard
              title="Total de saídas"
              value={formatBRL(resumo.saidas)}
              description="Somatório de lançamentos de saída"
            />
            <MetricCard
              title="Saldo"
              value={formatBRL(resumo.saldo)}
              description="Entradas menos saídas"
            />
          </div>

          {dialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <Card className="w-full max-w-lg border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <CardHeader>
                  <CardTitle>{editingId ? "Editar lançamento" : "Novo lançamento"}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Input
                    placeholder="Descrição"
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  />
                  <Input
                    placeholder="Valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  />
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm({ ...form, tipo: e.target.value as typeof emptyForm.tipo })
                    }
                    className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base md:text-sm"
                  >
                    {LANCAMENTO_TIPO_VALUES.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {LANCAMENTO_TIPO_LABELS[tipo]}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={salvarLancamento}>
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
              <CardTitle>Lançamentos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">Carregando lançamentos...</p>
                </div>
              ) : lancamentos.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum lançamento cadastrado. Clique em &quot;Novo Lançamento&quot; para começar.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left dark:bg-zinc-800">
                      <tr>
                        <th className="p-3">Data</th>
                        <th className="p-3">Descrição</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Valor</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos.map((lancamento) => (
                        <tr key={lancamento.id} className="border-t border-zinc-200 dark:border-zinc-800">
                          <td className="p-3">
                            {lancamento.data.slice(0, 10).split("-").reverse().join("/")}
                          </td>
                          <td className="p-3">{lancamento.descricao}</td>
                          <td className="p-3">
                            <Badge variant={lancamento.tipo === "ENTRADA" ? "default" : "destructive"}>
                              {LANCAMENTO_TIPO_LABELS[lancamento.tipo]}
                            </Badge>
                          </td>
                          <td className="p-3">{formatBRL(Number(lancamento.valor))}</td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(lancamento)}>
                                <Pencil size={16} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteLancamento(lancamento.id)}>
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
