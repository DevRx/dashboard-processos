"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  Cake,
  FolderPlus,
  FolderSearch,
  Gavel,
  IdCard,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  UserX,
  type LucideIcon,
} from "lucide-react"

import { Pagina } from "@/components/layout/pagina"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirmacao } from "@/components/ui/confirmacao"
import { FAIXA_POR_TOM, StatusBadge, tomDoStatus } from "@/components/dashboard/status-badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { DialogoCliente } from "@/components/clientes/dialogo-cliente"
import { DialogoProcesso } from "@/components/processos/dialogo-processo"
import { PainelInss } from "@/components/integracoes/painel-inss"
import { PreparoProtocolo } from "@/components/integracoes/preparo-protocolo"
import { DocumentosCliente } from "@/components/integracoes/documentos-cliente"
import {
  diasAte,
  formatarCPF,
  formatarData,
  formatarTelefone,
  prazoRelativo,
} from "@/lib/formatar"
import { cn } from "@/lib/utils"
import type { Cliente, Processo, User } from "@/lib/data"

function idade(nascimento?: string | null) {
  if (!nascimento) return null
  const [ano, mes, dia] = nascimento.slice(0, 10).split("-").map(Number)
  if (!ano) return null
  const hoje = new Date()
  let anos = hoje.getFullYear() - ano
  const aniversarioPassou =
    hoje.getMonth() + 1 > mes || (hoje.getMonth() + 1 === mes && hoje.getDate() >= dia)
  if (!aniversarioPassou) anos -= 1
  return anos
}

/** Um dado da ficha: ícone, nome do dado e o valor — ou o que falta. */
function Dado({
  icone: Icone,
  rotulo,
  valor,
  href,
  mono,
}: {
  icone: LucideIcon
  rotulo: string
  valor?: string | null
  href?: string
  mono?: boolean
}) {
  const vazio = !valor
  const conteudo = (
    <span
      className={cn(
        "block truncate text-[13.5px]",
        vazio ? "text-muted-foreground/70 italic" : "font-medium",
        mono && !vazio && "font-mono tabular-nums",
        href && !vazio && "hover:underline"
      )}
    >
      {vazio ? "não informado" : valor}
    </span>
  )

  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icone size={17} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {rotulo}
        </span>
        {href && !vazio ? <a href={href}>{conteudo}</a> : conteudo}
      </span>
    </div>
  )
}

export default function ClienteDetalhe() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [users, setUsers] = useState<User[]>([])
  // Id da ficha que já chegou. Enquanto for outro (ou nenhum), a tela
  // mostra o esqueleto — sem precisar de um `setLoading(true)` dentro
  // do efeito.
  const [idCarregado, setIdCarregado] = useState<string | null>(null)
  const loading = idCarregado !== id
  const [editando, setEditando] = useState(false)
  const [novoCaso, setNovoCaso] = useState(false)
  const { confirmar, dialogo: dialogoConfirmacao } = useConfirmacao()
  const abridorRef = useRef<HTMLElement | null>(null)

  // O preparo do protocolo precisa saber se há procuração vigente e se
  // o PDF está anexado. Buscado aqui em vez de erguido do painel de
  // integração: o endpoint é barato, e plumbing de estado entre irmãos
  // custaria mais do que uma requisição.
  const [baseLegal, setBaseLegal] = useState({ temVigente: false, temPdf: false })

  /**
   * Recarregar nunca troca a tela pelo skeleton: o skeleton desmonta os
   * cards, e desmontar o painel de integração no meio de uma importação
   * jogaria fora a prévia que o operador está revisando. Só a primeira
   * carga de cada id mostra o esqueleto — ver `idCarregado`.
   */
  const fetchCliente = useCallback(() => {
    const json = (r: Response) => (r.ok ? r.json() : null)
    return Promise.all([
      fetch(`/api/clientes/${id}`).then(json),
      fetch("/api/users").then(json),
      fetch(`/api/lgpd/consentimentos?clienteId=${id}`).then(json),
    ])
      .then(([clienteData, usersData, basesData]) => {
        if (clienteData) {
          setCliente(clienteData.cliente)
        } else {
          router.push("/clientes")
          return
        }
        if (usersData) setUsers(usersData.users)

        if (basesData) {
          const vigente = (basesData.consentimentos ?? []).find(
            (c: { revogadoEm: string | null }) => !c.revogadoEm
          )
          setBaseLegal({
            temVigente: Boolean(vigente),
            temPdf: Boolean(vigente?.procuracaoArquivo),
          })
        }
        setIdCarregado(id)
      })
      .catch((err) => console.error("Erro ao carregar cliente:", err))
  }, [id, router])

  useEffect(() => {
    fetchCliente()
  }, [fetchCliente])

  async function excluirProcesso(processo: Processo) {
    const ok = await confirmar({
      titulo: `Excluir o caso "${processo.beneficio || "sem benefício"}"?`,
      descricao: "Os andamentos e documentos anexados a ele também serão apagados.",
      rotuloConfirmar: "Excluir caso",
    })
    if (!ok) return
    try {
      await fetch(`/api/processos/${processo.id}`, { method: "DELETE" })
      fetchCliente()
    } catch (err) {
      console.error("Erro ao excluir processo:", err)
    }
  }

  function nomeResponsavel(responsavelId?: string | null) {
    if (!responsavelId) return null
    return users.find((u) => u.id === responsavelId)?.name ?? null
  }

  const voltar = { href: "/clientes", rotulo: "Voltar para a lista de clientes" }

  if (loading) {
    return (
      <Pagina titulo="Carregando…" subtitulo="Ficha do cliente" voltar={voltar}>
        <Skeleton className="h-36 w-full" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Pagina>
    )
  }

  if (!cliente) {
    return (
      <Pagina titulo="Cliente não encontrado" subtitulo="Ficha do cliente" voltar={voltar}>
        <section className="rounded-xl bg-card shadow-card">
          <EmptyState
            icon={UserX}
            title="Cliente não encontrado"
            description="Ele pode ter sido excluído. Volte para a lista e procure de novo."
            acao={
              <Link href="/clientes" className="text-sm font-medium text-primary hover:underline">
                Ir para a lista de clientes
              </Link>
            }
          />
        </section>
      </Pagina>
    )
  }

  const processos = cliente.processos || []
  const anos = idade(cliente.dataNascimento)
  const telefoneDigitos = (cliente.telefone ?? "").replace(/\D/g, "")

  const botaoNovoCaso = (
    <Button
      onClick={(e) => {
        abridorRef.current = e.currentTarget
        setNovoCaso(true)
      }}
    >
      <FolderPlus size={16} />
      Novo caso
    </Button>
  )

  return (
    <Pagina
      titulo={cliente.nome}
      subtitulo="Ficha do cliente"
      voltar={voltar}
      acoes={
        <>
          <Button
            variant="outline"
            onClick={(e) => {
              abridorRef.current = e.currentTarget
              setEditando(true)
            }}
          >
            <Pencil size={15} />
            Editar dados
          </Button>
          {botaoNovoCaso}
        </>
      }
    >
      {/* Cabeçalho da pessoa: quem é, o que busca, como falar com ela. */}
      <section className="overflow-hidden rounded-2xl bg-card shadow-card">
        <span aria-hidden className="block h-1 w-full bg-gradient-to-r from-primary via-brand to-primary" />
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start">
          <Avatar nome={cliente.nome} tamanho="xl" className="ring-4 ring-background" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-[22px] leading-tight font-semibold tracking-[-0.01em]">
                {cliente.nome}
              </h2>
              {cliente.beneficio ? (
                <Badge variant="info">{cliente.beneficio}</Badge>
              ) : (
                <Badge variant="muted">Benefício não definido</Badge>
              )}
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {processos.length === 0
                ? "Nenhum caso aberto ainda"
                : processos.length === 1
                  ? "1 caso no escritório"
                  : `${processos.length} casos no escritório`}
              {anos !== null && ` · ${anos} anos`}
              {" · "}cliente desde {formatarData(cliente.createdAt)}
            </p>

            <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
              <Dado icone={IdCard} rotulo="CPF" valor={cliente.cpf ? formatarCPF(cliente.cpf) : null} mono />
              <Dado
                icone={Phone}
                rotulo="Telefone / WhatsApp"
                valor={cliente.telefone ? formatarTelefone(cliente.telefone) : null}
                href={telefoneDigitos ? `https://wa.me/55${telefoneDigitos}` : undefined}
              />
              <Dado
                icone={Mail}
                rotulo="E-mail"
                valor={cliente.email}
                href={cliente.email ? `mailto:${cliente.email}` : undefined}
              />
              <Dado
                icone={Cake}
                rotulo="Nascimento"
                valor={cliente.dataNascimento ? formatarData(cliente.dataNascimento) : null}
              />
              <Dado icone={MapPin} rotulo="Endereço" valor={cliente.endereco} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className="flex flex-col overflow-hidden rounded-xl bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 className="font-heading text-[15px] font-semibold">Casos</h3>
              <p className="text-[12px] text-muted-foreground">
                Requerimentos no INSS e ações na Justiça
              </p>
            </div>
            <Button
              variant="soft"
              size="sm"
              onClick={(e) => {
                abridorRef.current = e.currentTarget
                setNovoCaso(true)
              }}
            >
              <FolderPlus size={14} />
              Novo caso
            </Button>
          </div>

          {processos.length === 0 ? (
            <EmptyState
              icon={FolderSearch}
              title="Nenhum caso aberto"
              description="Abra o primeiro caso desta pessoa: um requerimento no INSS ou uma ação na Justiça."
              acao={botaoNovoCaso}
            />
          ) : (
            <ul className="flex flex-col gap-3 p-4">
              {processos.map((processo: Processo) => {
                const judicial = processo.esfera === "JUDICIAL"
                const responsavel = nomeResponsavel(processo.responsavelId)
                const dias = processo.prazo ? diasAte(processo.prazo) : null

                return (
                  <li
                    key={processo.id}
                    className={cn(
                      "rounded-lg border border-l-4 border-border bg-background/40 p-4",
                      FAIXA_POR_TOM[tomDoStatus(processo.status)]
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={judicial ? "secondary" : "outline"} className="gap-1">
                            {judicial ? <Gavel /> : <Landmark />}
                            {judicial ? "Justiça" : "INSS"}
                          </Badge>
                          <StatusBadge status={processo.status} />
                        </div>
                        <p className="font-heading mt-2 text-[15px] leading-snug font-semibold">
                          {processo.beneficio || "Benefício não informado"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Excluir caso"
                        aria-label="Excluir caso"
                        className="text-muted-foreground hover:bg-status-danger hover:text-status-danger-foreground"
                        onClick={() => excluirProcesso(processo)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>

                    <dl className="mt-3 grid gap-x-4 gap-y-2 text-[12.5px] sm:grid-cols-2">
                      {processo.numero && (
                        <div>
                          <dt className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Número CNJ</dt>
                          <dd className="font-mono tabular-nums">{processo.numero}</dd>
                        </div>
                      )}
                      {processo.protocoloInss && (
                        <div>
                          <dt className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Protocolo INSS</dt>
                          <dd className="font-mono tabular-nums">{processo.protocoloInss}</dd>
                        </div>
                      )}
                      {processo.numeroBeneficio && (
                        <div>
                          <dt className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">NB</dt>
                          <dd className="font-mono tabular-nums">{processo.numeroBeneficio}</dd>
                        </div>
                      )}
                      {responsavel && (
                        <div>
                          <dt className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Responsável</dt>
                          <dd className="flex items-center gap-1.5">
                            <Avatar nome={responsavel} tamanho="xs" />
                            {responsavel}
                          </dd>
                        </div>
                      )}
                      {processo.dataEntrada && (
                        <div>
                          <dt className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Entrada</dt>
                          <dd className="font-mono tabular-nums">{formatarData(processo.dataEntrada)}</dd>
                        </div>
                      )}
                      {processo.prazo && dias !== null && (
                        <div>
                          <dt className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Prazo</dt>
                          <dd
                            className={cn(
                              "font-mono tabular-nums",
                              dias < 0 && "font-semibold text-status-danger-foreground",
                              dias >= 0 && dias <= 3 && "font-semibold text-status-warning-foreground"
                            )}
                          >
                            {formatarData(processo.prazo)}{" "}
                            <span className="font-sans font-normal">({prazoRelativo(processo.prazo)})</span>
                          </dd>
                        </div>
                      )}
                      {(processo.tribunal || processo.vara) && (
                        <div className="sm:col-span-2">
                          <dt className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Onde corre</dt>
                          <dd>{[processo.tribunal, processo.vara].filter(Boolean).join(" · ")}</dd>
                        </div>
                      )}
                      {processo.observacoes && (
                        <div className="sm:col-span-2">
                          <dt className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Observações</dt>
                          <dd className="leading-relaxed text-foreground/85">{processo.observacoes}</dd>
                        </div>
                      )}
                    </dl>

                    <PreparoProtocolo
                      cliente={cliente}
                      processo={processo}
                      outrosProcessos={processos}
                      baseLegal={baseLegal}
                      usuarios={users}
                      onProtocolado={() => fetchCliente()}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <DocumentosCliente clienteId={cliente.id} processos={processos} />
          <PainelInss
            clienteId={cliente.id}
            processos={processos}
            onAplicado={() => fetchCliente()}
          />
        </div>
      </div>

      <DialogoCliente
        aberto={editando}
        onOpenChange={setEditando}
        cliente={cliente}
        onSalvo={() => fetchCliente()}
        finalFocus={abridorRef}
      />
      <DialogoProcesso
        aberto={novoCaso}
        onOpenChange={setNovoCaso}
        clienteId={cliente.id}
        usuarios={users}
        onSalvo={() => fetchCliente()}
        finalFocus={abridorRef}
      />
      {dialogoConfirmacao}
    </Pagina>
  )
}
