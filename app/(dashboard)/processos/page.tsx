"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Clock,
  FolderPlus,
  FolderSearch,
  Gavel,
  Landmark,
  LayoutGrid,
  List,
  Search,
  Trash2,
} from "lucide-react"

import { Pagina } from "@/components/layout/pagina"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Segmentado } from "@/components/ui/segmentado"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirmacao } from "@/components/ui/confirmacao"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { KanbanBoard } from "@/components/processos/kanban-board"
import { DialogoProcesso } from "@/components/processos/dialogo-processo"
import { diasAte, formatarData, prazoRelativo } from "@/lib/formatar"
import { cn } from "@/lib/utils"
import {
  PROCESSO_STATUS_LABELS,
  PROCESSO_STATUS_VALUES,
  type Processo,
  type Cliente,
  type User,
} from "@/lib/data"

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

export default function Processos() {
  const [processos, setProcessos] = useState<Processo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [visao, setVisao] = useState<"lista" | "board">("board")
  const [busca, setBusca] = useState("")
  const [filtroStatus, setFiltroStatus] = useState("")
  const { confirmar, dialogo: dialogoConfirmacao } = useConfirmacao()

  // Elemento que abriu o modal — o Dialog é controlado, então o base-ui
  // não descobre sozinho para onde devolver o foco.
  const abridorRef = useRef<HTMLElement | null>(null)

  const fetchData = useCallback(() => {
    const json = (r: Response) => (r.ok ? r.json() : null)
    return Promise.all([
      fetch("/api/processos").then(json),
      fetch("/api/clientes").then(json),
      fetch("/api/users").then(json),
    ])
      .then(([processosData, clientesData, usersData]) => {
        if (processosData) setProcessos(processosData.processos)
        if (clientesData) setClientes(clientesData.clientes)
        if (usersData) setUsers(usersData.users)
      })
      .catch((err) => console.error("Erro ao carregar dados:", err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const clientePorId = useMemo(
    () => new Map(clientes.map((c) => [c.id, c])),
    [clientes]
  )
  const usuarioPorId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  async function excluir(processo: Processo) {
    const nome = clientePorId.get(processo.clienteId)?.nome ?? "este cliente"
    const ok = await confirmar({
      titulo: `Excluir o caso de ${nome}?`,
      descricao: `${processo.beneficio || "Processo"} — os andamentos e documentos anexados também serão apagados.`,
      rotuloConfirmar: "Excluir caso",
    })
    if (!ok) return
    try {
      await fetch(`/api/processos/${processo.id}`, { method: "DELETE" })
      fetchData()
    } catch (err) {
      console.error("Erro ao excluir processo:", err)
    }
  }

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    const digitos = termo.replace(/\D/g, "")

    return processos.filter((p) => {
      if (filtroStatus && p.status !== filtroStatus) return false
      if (!termo) return true

      const cliente = clientePorId.get(p.clienteId)
      const numero = (p.numero ?? "").replace(/\D/g, "")
      const protocolo = (p.protocoloInss ?? "").replace(/\D/g, "")
      return (
        normalizar(cliente?.nome ?? "").includes(termo) ||
        normalizar(p.beneficio ?? "").includes(termo) ||
        (digitos.length > 0 && (numero.includes(digitos) || protocolo.includes(digitos)))
      )
    })
  }, [processos, busca, filtroStatus, clientePorId])

  const filtrando = Boolean(busca.trim() || filtroStatus)

  const botaoNovo = (
    <Button
      onClick={(e) => {
        abridorRef.current = e.currentTarget
        setDialogOpen(true)
      }}
    >
      <FolderPlus size={16} />
      Novo caso
    </Button>
  )

  return (
    <Pagina
      titulo="Processos"
      subtitulo="Todos os casos do escritório, no INSS e na Justiça"
      acoes={botaoNovo}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Search
            size={16}
            strokeWidth={1.9}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, benefício ou número"
            aria-label="Buscar processo"
            className="pl-9"
          />
        </div>

        <Select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          aria-label="Filtrar por situação"
          className="w-full sm:w-56"
        >
          <option value="">Todas as situações</option>
          {PROCESSO_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {PROCESSO_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>

        <div className="flex flex-1 items-center justify-between gap-3">
          {!loading && (
            <p className="text-[13px] text-muted-foreground tabular-nums">
              {filtrando
                ? `${filtrados.length} de ${processos.length}`
                : `${processos.length} ${processos.length === 1 ? "caso" : "casos"}`}
            </p>
          )}
          <Segmentado
            valor={visao}
            onChange={setVisao}
            aria-label="Modo de visualização"
            className="ml-auto"
            opcoes={[
              { valor: "board", rotulo: "Quadro", icone: LayoutGrid },
              { valor: "lista", rotulo: "Lista", icone: List },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : processos.length === 0 ? (
        <section className="rounded-xl bg-card ring-1 ring-foreground/10">
          <EmptyState
            icon={FolderSearch}
            title="Nenhum caso cadastrado ainda"
            description="Abra o primeiro caso: um requerimento no INSS ou uma ação na Justiça."
            acao={botaoNovo}
          />
        </section>
      ) : filtrados.length === 0 ? (
        <section className="rounded-xl bg-card ring-1 ring-foreground/10">
          <EmptyState
            icon={Search}
            title="Nada encontrado"
            description="Nenhum caso corresponde à busca e ao filtro escolhidos."
            acao={
              <Button
                variant="outline"
                onClick={() => {
                  setBusca("")
                  setFiltroStatus("")
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        </section>
      ) : visao === "board" ? (
        <KanbanBoard
          processos={filtrados}
          clientes={clientes}
          users={users}
          onUpdated={fetchData}
        />
      ) : (
        <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <ul className="divide-y divide-border">
            {filtrados.map((processo) => {
              const cliente = clientePorId.get(processo.clienteId)
              const responsavel = processo.responsavelId
                ? usuarioPorId.get(processo.responsavelId)
                : null
              const judicial = processo.esfera === "JUDICIAL"
              const dias = processo.prazo ? diasAte(processo.prazo) : null

              return (
                <li
                  key={processo.id}
                  className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-muted/40 md:flex-row md:items-center"
                >
                  <Link
                    href={`/clientes/${processo.clienteId}`}
                    className="flex min-w-0 flex-1 items-center gap-3 outline-none"
                  >
                    <Avatar nome={cliente?.nome} tamanho="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold hover:underline">
                        {cliente?.nome ?? "—"}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
                        <span className="truncate">{processo.beneficio || "Benefício não informado"}</span>
                        {(processo.numero || processo.protocoloInss) && (
                          <span className="font-mono tabular-nums">
                            {processo.numero || `Prot. ${processo.protocoloInss}`}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Badge variant={judicial ? "secondary" : "outline"} className="gap-1">
                      {judicial ? <Gavel /> : <Landmark />}
                      {judicial ? "Justiça" : "INSS"}
                    </Badge>

                    <StatusBadge status={processo.status} />

                    {processo.prazo && dias !== null && (
                      <span
                        title={`Prazo: ${formatarData(processo.prazo)}`}
                        className={cn(
                          "inline-flex items-center gap-1 text-[12px]",
                          dias < 0
                            ? "font-medium text-status-danger-foreground"
                            : dias <= 3
                              ? "font-medium text-status-warning-foreground"
                              : "text-muted-foreground"
                        )}
                      >
                        {dias <= 3 ? <AlertTriangle size={13} /> : <Clock size={13} />}
                        {dias < 0 ? "venceu " : "vence "}
                        {prazoRelativo(processo.prazo)}
                      </span>
                    )}

                    {responsavel ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"
                        title={`Responsável: ${responsavel.name}`}
                      >
                        <Avatar nome={responsavel.name} tamanho="xs" />
                        <span className="hidden max-w-[8rem] truncate xl:inline">
                          {responsavel.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted-foreground/70">Sem responsável</span>
                    )}

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Excluir caso"
                      aria-label="Excluir caso"
                      className="text-muted-foreground hover:bg-status-danger hover:text-status-danger-foreground"
                      onClick={() => excluir(processo)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <DialogoProcesso
        aberto={dialogOpen}
        onOpenChange={setDialogOpen}
        clientes={clientes}
        usuarios={users}
        onSalvo={fetchData}
        finalFocus={abridorRef}
      />
      {dialogoConfirmacao}
    </Pagina>
  )
}
