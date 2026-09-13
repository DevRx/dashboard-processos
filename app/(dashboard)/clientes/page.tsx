"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronRight, Pencil, Phone, Search, Trash2, UserPlus, Users } from "lucide-react"

import { Pagina } from "@/components/layout/pagina"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirmacao } from "@/components/ui/confirmacao"
import { EmptyState } from "@/components/dashboard/empty-state"
import { DialogoCliente } from "@/components/clientes/dialogo-cliente"
import { formatarCPF, formatarTelefone } from "@/lib/formatar"
import type { Cliente } from "@/lib/data"

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

export default function ClientesPage() {
  return (
    <Suspense fallback={null}>
      <Clientes />
    </Suspense>
  )
}

function Clientes() {
  const router = useRouter()
  const params = useSearchParams()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")
  // `/clientes?novo=1` — o atalho da tela inicial já chega com o
  // cadastro aberto. O parâmetro sai da URL logo abaixo, para o F5
  // não reabrir.
  const [dialogoAberto, setDialogoAberto] = useState(() => params.get("novo") === "1")
  const [editando, setEditando] = useState<Cliente | null>(null)
  const { confirmar, dialogo: dialogoConfirmacao } = useConfirmacao()

  // Elemento que abriu o modal ("Novo cliente" ou o lápis de uma linha).
  // O Dialog é controlado, então o base-ui não descobre sozinho para onde
  // devolver o foco ao fechar — passamos via `finalFocus`.
  const abridorRef = useRef<HTMLElement | null>(null)

  const fetchClientes = useCallback(() => {
    return fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : { clientes: [] }))
      .then((data) => setClientes(data.clientes ?? []))
      .catch((err) => console.error("Erro ao carregar clientes:", err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  useEffect(() => {
    if (params.get("novo") === "1") router.replace("/clientes")
  }, [params, router])

  function abrirNovo(e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditando(null)
    setDialogoAberto(true)
  }

  function abrirEdicao(cliente: Cliente, e: React.MouseEvent<HTMLButtonElement>) {
    abridorRef.current = e.currentTarget
    setEditando(cliente)
    setDialogoAberto(true)
  }

  async function excluir(cliente: Cliente) {
    const ok = await confirmar({
      titulo: `Excluir ${cliente.nome}?`,
      descricao:
        "Os processos, documentos e tarefas dessa pessoa também serão apagados. Isso não pode ser desfeito.",
      rotuloConfirmar: "Excluir cliente",
    })
    if (!ok) return

    try {
      await fetch(`/api/clientes/${cliente.id}`, { method: "DELETE" })
      fetchClientes()
    } catch (err) {
      console.error("Erro ao excluir cliente:", err)
    }
  }

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    if (!termo) return clientes
    const digitos = termo.replace(/\D/g, "")

    return clientes.filter((c) => {
      const cpf = (c.cpf ?? "").replace(/\D/g, "")
      const tel = (c.telefone ?? "").replace(/\D/g, "")
      return (
        normalizar(c.nome).includes(termo) ||
        normalizar(c.beneficio ?? "").includes(termo) ||
        (digitos.length > 0 && (cpf.includes(digitos) || tel.includes(digitos)))
      )
    })
  }, [clientes, busca])

  const botaoNovo = (
    <Button onClick={abrirNovo}>
      <UserPlus size={16} />
      Novo cliente
    </Button>
  )

  return (
    <Pagina
      titulo="Clientes"
      subtitulo="Todas as pessoas atendidas pelo escritório"
      acoes={botaoNovo}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search
            size={16}
            strokeWidth={1.9}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF, telefone ou benefício"
            aria-label="Buscar cliente"
            className="pl-9"
          />
        </div>
        {!loading && (
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {busca.trim()
              ? `${filtrados.length} de ${clientes.length}`
              : `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}
          </p>
        )}
      </div>

      <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : clientes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente cadastrado ainda"
            description="Cadastre a primeira pessoa atendida. Depois, os processos dela ficam todos na ficha."
            acao={botaoNovo}
          />
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nada encontrado"
            description={`Nenhum cliente corresponde a "${busca}". Confira a grafia ou tente só o primeiro nome.`}
          />
        ) : (
          <ul className="divide-y divide-border">
            {filtrados.map((cliente) => (
              <li key={cliente.id} className="flex items-center gap-2 pr-2 transition-colors hover:bg-muted/40">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 outline-none focus-visible:bg-muted/50"
                >
                  <Avatar nome={cliente.nome} tamanho="md" />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      {cliente.nome}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                      <span className="font-mono tabular-nums">
                        CPF {formatarCPF(cliente.cpf)}
                      </span>
                      {cliente.telefone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={11} />
                          {formatarTelefone(cliente.telefone)}
                        </span>
                      )}
                    </span>
                  </span>

                  {cliente.beneficio ? (
                    <Badge variant="info" className="hidden max-w-[220px] truncate md:inline-flex">
                      {cliente.beneficio}
                    </Badge>
                  ) : (
                    <Badge variant="muted" className="hidden md:inline-flex">
                      Sem benefício definido
                    </Badge>
                  )}

                  <span className="hidden items-center gap-1 text-[12.5px] font-medium text-primary sm:inline-flex dark:text-accent-foreground">
                    Abrir ficha
                    <ChevronRight
                      size={15}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Editar dados"
                    aria-label={`Editar ${cliente.nome}`}
                    onClick={(e) => abrirEdicao(cliente, e)}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Excluir cliente"
                    aria-label={`Excluir ${cliente.nome}`}
                    className="text-muted-foreground hover:bg-status-danger hover:text-status-danger-foreground"
                    onClick={() => excluir(cliente)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DialogoCliente
        aberto={dialogoAberto}
        onOpenChange={setDialogoAberto}
        cliente={editando}
        onSalvo={() => fetchClientes()}
        finalFocus={abridorRef}
      />
      {dialogoConfirmacao}
    </Pagina>
  )
}
