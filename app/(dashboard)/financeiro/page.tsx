"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Wallet,
} from "lucide-react"

import { Pagina } from "@/components/layout/pagina"
import { Button } from "@/components/ui/button"
import { Campo, LinhaCampos } from "@/components/ui/campo"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Segmentado } from "@/components/ui/segmentado"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirmacao } from "@/components/ui/confirmacao"
import { MetricCard } from "@/components/dashboard/metric-card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { formatarBRL, hojeISO, partesData } from "@/lib/formatar"
import { cn } from "@/lib/utils"
import { type LancamentoFinanceiro, type LancamentoTipo } from "@/lib/data"

const VAZIO = {
  descricao: "",
  valor: "",
  tipo: "ENTRADA" as LancamentoTipo,
  data: "",
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

function rotuloMes(chave: string) {
  const [ano, mes] = chave.split("-")
  return `${MESES[Number(mes) - 1]} de ${ano}`
}

export default function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mes, setMes] = useState("")
  const { confirmar, dialogo: dialogoConfirmacao } = useConfirmacao()

  // Elemento que abriu o modal. O Dialog é controlado, então o base-ui não
  // descobre sozinho para onde devolver o foco — passamos via `finalFocus`.
  const abridorRef = useRef<HTMLElement | null>(null)

  const fetchLancamentos = useCallback(() => {
    return fetch("/api/financeiro")
      .then((r) => (r.ok ? r.json() : { lancamentos: [] }))
      .then((data) => setLancamentos(data.lancamentos ?? []))
      .catch((err) => console.error("Erro ao carregar financeiro:", err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchLancamentos()
  }, [fetchLancamentos])

  const meses = useMemo(() => {
    const chaves = new Set(lancamentos.map((l) => l.data.slice(0, 7)))
    return [...chaves].sort().reverse()
  }, [lancamentos])

  const visiveis = useMemo(() => {
    const lista = mes ? lancamentos.filter((l) => l.data.slice(0, 7) === mes) : lancamentos
    return [...lista].sort((a, b) => b.data.localeCompare(a.data))
  }, [lancamentos, mes])

  const resumo = useMemo(() => {
    const entradas = visiveis
      .filter((l) => l.tipo === "ENTRADA")
      .reduce((acc, l) => acc + Number(l.valor), 0)
    const saidas = visiveis
      .filter((l) => l.tipo === "SAIDA")
      .reduce((acc, l) => acc + Number(l.valor), 0)
    return { entradas, saidas, saldo: entradas - saidas }
  }, [visiveis])

  function abrirNovo(e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditingId(null)
    setForm({ ...VAZIO, data: hojeISO() })
    setErro(null)
    setDialogOpen(true)
  }

  function abrirEdicao(l: LancamentoFinanceiro, e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditingId(l.id)
    setForm({
      descricao: l.descricao,
      valor: String(l.valor),
      tipo: l.tipo,
      data: l.data ? l.data.slice(0, 10) : "",
    })
    setErro(null)
    setDialogOpen(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const valorNumero = parseFloat(form.valor.replace(",", "."))
    if (!form.descricao.trim()) return setErro("Diga do que se trata o lançamento.")
    if (!valorNumero || valorNumero <= 0) return setErro("Informe um valor maior que zero.")
    if (!form.data) return setErro("Escolha a data.")

    setSalvando(true)
    setErro(null)
    try {
      const response = await fetch(
        editingId ? `/api/financeiro/${editingId}` : "/api/financeiro",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descricao: form.descricao,
            valor: valorNumero,
            tipo: form.tipo,
            data: form.data,
          }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setErro(data.error || "Não foi possível salvar. Tente de novo.")
        return
      }
      setDialogOpen(false)
      fetchLancamentos()
    } catch {
      setErro("Sem conexão. Verifique a internet e tente de novo.")
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(l: LancamentoFinanceiro) {
    const ok = await confirmar({
      titulo: `Excluir "${l.descricao}"?`,
      descricao: `${l.tipo === "ENTRADA" ? "Entrada" : "Saída"} de ${formatarBRL(Number(l.valor))}. O saldo será recalculado.`,
      rotuloConfirmar: "Excluir lançamento",
    })
    if (!ok) return
    try {
      await fetch(`/api/financeiro/${l.id}`, { method: "DELETE" })
      fetchLancamentos()
    } catch (err) {
      console.error("Erro ao excluir lançamento:", err)
    }
  }

  const botaoNovo = (
    <Button onClick={abrirNovo}>
      <Plus size={16} />
      Novo lançamento
    </Button>
  )

  const periodo = mes ? rotuloMes(mes) : "todo o período"

  return (
    <Pagina
      titulo="Financeiro"
      subtitulo="O que entrou e o que saiu do caixa do escritório"
      acoes={botaoNovo}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          aria-label="Período"
          className="w-full sm:w-60"
        >
          <option value="">Todo o período</option>
          {meses.map((m) => (
            <option key={m} value={m}>
              {rotuloMes(m)}
            </option>
          ))}
        </Select>
        {!loading && (
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {visiveis.length} {visiveis.length === 1 ? "lançamento" : "lançamentos"}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={ArrowDownLeft}
          tom="sucesso"
          title="Entradas"
          value={formatarBRL(resumo.entradas)}
          description={`Recebido em ${periodo}`}
        />
        <MetricCard
          icon={ArrowUpRight}
          tom="perigo"
          title="Saídas"
          value={formatarBRL(resumo.saidas)}
          description={`Pago em ${periodo}`}
        />
        <MetricCard
          icon={Wallet}
          tom={resumo.saldo >= 0 ? "info" : "alerta"}
          title="Saldo"
          value={formatarBRL(resumo.saldo)}
          description={resumo.saldo >= 0 ? "Entradas menos saídas" : "Atenção: saiu mais do que entrou"}
        />
      </div>

      <section className="overflow-hidden rounded-xl bg-card shadow-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : lancamentos.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum lançamento ainda"
            description="Registre a primeira entrada ou saída. Os totais no alto se atualizam sozinhos."
            acao={botaoNovo}
          />
        ) : visiveis.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nada neste mês"
            description="Não há lançamentos no período escolhido."
            acao={
              <Button variant="outline" onClick={() => setMes("")}>
                Ver todo o período
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visiveis.map((l) => {
              const entrada = l.tipo === "ENTRADA"
              const { dia, mes: mesCurto } = partesData(l.data)
              return (
                <li key={l.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                  <span
                    className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted py-1.5 leading-none text-muted-foreground"
                    title={l.data.slice(0, 10)}
                  >
                    <span className="font-heading text-lg font-semibold text-foreground tabular-nums">{dia}</span>
                    <span className="mt-0.5 text-[10px] font-semibold tracking-wide uppercase">{mesCurto}</span>
                  </span>

                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      entrada
                        ? "bg-status-success text-status-success-foreground"
                        : "bg-status-danger text-status-danger-foreground"
                    )}
                    aria-label={entrada ? "Entrada" : "Saída"}
                  >
                    {entrada ? <ArrowDownLeft size={17} strokeWidth={2.2} /> : <ArrowUpRight size={17} strokeWidth={2.2} />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{l.descricao}</span>
                    <span className="block text-[12px] text-muted-foreground">
                      {entrada ? "Entrada" : "Saída"}
                    </span>
                  </span>

                  <span
                    className={cn(
                      "font-heading shrink-0 text-[15px] font-semibold tabular-nums",
                      entrada ? "text-status-success-foreground" : "text-status-danger-foreground"
                    )}
                  >
                    {entrada ? "+" : "−"} {formatarBRL(Number(l.valor))}
                  </span>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Editar"
                      aria-label={`Editar ${l.descricao}`}
                      onClick={(e) => abrirEdicao(l, e)}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Excluir"
                      aria-label={`Excluir ${l.descricao}`}
                      className="text-muted-foreground hover:bg-status-danger hover:text-status-danger-foreground"
                      onClick={() => excluir(l)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" finalFocus={abridorRef}>
          <form onSubmit={salvar} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Ajuste o que mudou." : "Dinheiro que entrou ou que saiu do escritório."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <Campo rotulo="Tipo" grupo>
                <Segmentado
                  cheio
                  tamanho="lg"
                  valor={form.tipo}
                  onChange={(tipo) => setForm({ ...form, tipo })}
                  aria-label="Tipo do lançamento"
                  opcoes={[
                    { valor: "ENTRADA", rotulo: "Entrada", icone: ArrowDownLeft, tom: "sucesso" },
                    { valor: "SAIDA", rotulo: "Saída", icone: ArrowUpRight, tom: "perigo" },
                  ]}
                />
              </Campo>

              <Campo rotulo="Descrição" obrigatorio>
                <Input
                  autoFocus
                  placeholder={form.tipo === "ENTRADA" ? "Ex.: Honorários da Maria" : "Ex.: Aluguel do escritório"}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  required
                />
              </Campo>

              <LinhaCampos>
                <Campo rotulo="Valor" obrigatorio>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      R$
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={form.valor}
                      onChange={(e) => setForm({ ...form, valor: e.target.value })}
                      className="pl-9 tabular-nums"
                      required
                    />
                  </div>
                </Campo>
                <Campo rotulo="Data" obrigatorio>
                  <Input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                    required
                  />
                </Campo>
              </LinhaCampos>
            </div>

            {erro && (
              <p role="alert" className="rounded-lg bg-status-danger px-3 py-2 text-[13px] text-status-danger-foreground">
                {erro}
              </p>
            )}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
              <Button type="submit" disabled={salvando}>
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? "Salvar alterações" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {dialogoConfirmacao}
    </Pagina>
  )
}
