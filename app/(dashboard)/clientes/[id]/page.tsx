"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PainelInss } from "@/components/integracoes/painel-inss"
import { Trash2, Save, Search, Loader2, FolderSearch, UserX } from "lucide-react"
import {
  PROCESSO_STATUS_LABELS,
  PROCESSO_STATUS_VALUES,
  type Cliente,
  type EsferaProcesso,
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
    esfera: "ADMINISTRATIVO" as EsferaProcesso,
    numero: "",
    protocoloInss: "",
    status: "EM_ANALISE",
    responsavelId: "",
    dataEntrada: "",
    prazo: "",
    tribunal: "",
    vara: "",
    observacoes: "",
  })
  const [buscandoDataJud, setBuscandoDataJud] = useState(false)
  const [dataJudMsg, setDataJudMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null)

  /**
   * `silencioso` recarrega sem trocar a tela pelo skeleton. O skeleton
   * desmonta os cards, e desmontar o painel de integração no meio de
   * uma importação jogaria fora a prévia que o operador está revisando.
   */
  async function fetchCliente(silencioso = false) {
    if (!silencioso) setLoading(true)
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
          esfera: "ADMINISTRATIVO",
          numero: "",
          protocoloInss: "",
          status: "EM_ANALISE",
          responsavelId: "",
          dataEntrada: "",
          prazo: "",
          tribunal: "",
          vara: "",
          observacoes: "",
        })
        setDataJudMsg(null)
        fetchCliente()
      }
    } catch (err) {
      console.error("Erro ao salvar processo:", err)
    }
  }

  async function buscarNoDataJud() {
    if (!novoProcesso.numero.trim()) return
    setBuscandoDataJud(true)
    setDataJudMsg(null)
    try {
      const res = await fetch(
        `/api/processos/lookup?numero=${encodeURIComponent(novoProcesso.numero)}`
      )
      const data = await res.json()

      if (!res.ok) {
        setDataJudMsg({ tipo: "erro", texto: data.error || "Erro ao buscar processo" })
        return
      }

      const d = data.dados
      const infoExtra = [
        d.classe ? `Classe: ${d.classe}` : null,
        d.ultimoMovimento
          ? `Último movimento: ${d.ultimoMovimento.nome}${d.ultimoMovimento.data ? ` (${d.ultimoMovimento.data.slice(0, 10).split("-").reverse().join("/")})` : ""}`
          : null,
      ]
        .filter(Boolean)
        .join(" — ")

      setNovoProcesso((prev) => ({
        ...prev,
        beneficio: d.assuntos?.[0] || prev.beneficio,
        dataEntrada: d.dataAjuizamento ? d.dataAjuizamento.slice(0, 10) : prev.dataEntrada,
        tribunal: d.tribunal || prev.tribunal,
        vara: d.orgaoJulgador || prev.vara,
        observacoes: infoExtra
          ? [prev.observacoes, infoExtra].filter(Boolean).join(" | ")
          : prev.observacoes,
      }))
      setDataJudMsg({ tipo: "ok", texto: "Dados encontrados e preenchidos. Confira o benefício antes de salvar." })
    } catch (err) {
      console.error("Erro ao buscar no DataJud:", err)
      setDataJudMsg({ tipo: "erro", texto: "Erro de conexão ao buscar o processo" })
    } finally {
      setBuscandoDataJud(false)
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
      <div className="flex min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Header title="Clientes" subtitle="Carregando detalhes..." />
          <main className="flex-1 space-y-3 p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full" />
          </main>
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="flex min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Header title="Clientes" subtitle="Cliente não encontrado" />
          <main className="flex-1 p-6">
            <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <EmptyState icon={UserX} title="Cliente não encontrado" />
            </Card>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header title={cliente.nome} subtitle="Detalhes do cliente" />
        <main className="flex-1 p-6">
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

        <PainelInss
          clienteId={cliente.id}
          processos={processos}
          onAplicado={() => fetchCliente(true)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Processos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processos.length === 0 ? (
              <EmptyState icon={FolderSearch} title="Nenhum processo cadastrado" />
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
                        Status: <StatusBadge status={processo.status} className="text-xs" />
                      </p>
                      {processo.numero && (
                        <p className="text-sm">Número CNJ: {processo.numero}</p>
                      )}
                      {processo.protocoloInss && (
                        <p className="text-sm">
                          Protocolo INSS: {processo.protocoloInss}
                        </p>
                      )}
                      {processo.numeroBeneficio && (
                        <p className="text-sm">NB: {processo.numeroBeneficio}</p>
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
          <CardTitle>Novo caso</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* A esfera vem primeiro porque decide quais identificadores
              existem. Requerimento no INSS tem protocolo; número CNJ,
              tribunal e vara só passam a existir na via judicial. */}
          <select
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={novoProcesso.esfera}
            onChange={(e) =>
              setNovoProcesso({
                ...novoProcesso,
                esfera: e.target.value as EsferaProcesso,
              })
            }
          >
            <option value="ADMINISTRATIVO">
              Administrativo — requerimento no INSS
            </option>
            <option value="JUDICIAL">Judicial — ação com número CNJ</option>
          </select>

          {novoProcesso.esfera === "ADMINISTRATIVO" ? (
            <Input
              placeholder="Protocolo do requerimento (INSS)"
              value={novoProcesso.protocoloInss}
              onChange={(e) =>
                setNovoProcesso({
                  ...novoProcesso,
                  protocoloInss: e.target.value,
                })
              }
            />
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Número do processo (CNJ)"
                value={novoProcesso.numero}
                onChange={(e) =>
                  setNovoProcesso({ ...novoProcesso, numero: e.target.value })
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={buscarNoDataJud}
                disabled={buscandoDataJud || !novoProcesso.numero.trim()}
              >
                {buscandoDataJud ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
              </Button>
            </div>
          )}
          {dataJudMsg && (
            <p
              className={
                dataJudMsg.tipo === "erro"
                  ? "text-sm text-destructive"
                  : "text-sm text-emerald-600 dark:text-emerald-400"
              }
            >
              {dataJudMsg.texto}
            </p>
          )}

          <Input
            placeholder="Tipo de benefício"
            value={novoProcesso.beneficio}
            onChange={(e) =>
              setNovoProcesso({ ...novoProcesso, beneficio: e.target.value })
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

          <div className="flex gap-2">
            <Input
              placeholder="Data de entrada"
              type="date"
              value={novoProcesso.dataEntrada}
              onChange={(e) =>
                setNovoProcesso({ ...novoProcesso, dataEntrada: e.target.value })
              }
            />
            <Input
              placeholder="Prazo"
              type="date"
              value={novoProcesso.prazo}
              onChange={(e) =>
                setNovoProcesso({ ...novoProcesso, prazo: e.target.value })
              }
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Tribunal (ex: TRF3)"
              value={novoProcesso.tribunal}
              onChange={(e) =>
                setNovoProcesso({ ...novoProcesso, tribunal: e.target.value })
              }
            />
            <Input
              placeholder="Vara / órgão julgador"
              value={novoProcesso.vara}
              onChange={(e) =>
                setNovoProcesso({ ...novoProcesso, vara: e.target.value })
              }
            />
          </div>
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
      </div>
    </div>
  )
}
