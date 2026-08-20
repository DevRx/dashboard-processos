"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  FASES_JUDICIAIS,
  FASE_DESCRICAO,
  FASE_LABEL,
  STATUS_JUDICIAIS,
  STATUS_LABEL_JUDICIAL,
  faseDoStatus,
  type FaseJudicial,
} from "@/lib/domain/processo"

/**
 * Quadro da fila judicial.
 *
 * As colunas são fases, não status: o mesmo enum do administrativo
 * serve aos dois lados, e no judicial ele é lido por outro
 * vocabulário — ver lib/domain/processo/fase-judicial.ts.
 *
 * Aqui não há arrastar-e-soltar de propósito. Duas colunas agregam
 * dois status cada ("Sentença" é procedente ou improcedente), e soltar
 * um cartão obrigaria a escolher um dos dois por conta própria — é a
 * diferença entre ganhar e perder a causa. A troca é pelo menu, onde a
 * escolha é explícita.
 */

export type ItemJudicial = {
  id: string
  clienteId: string
  cliente: string
  cpf: string | null
  beneficio: string
  numero: string | null
  status: string
  tribunal: string | null
  vara: string | null
  comarca: string | null
  dataEntrada: string | null
  prazo: string | null
  ultimoAndamento: { data: string; descricao: string } | null
  totalAndamentos: number
}

type DadosDataJud = {
  numeroProcesso: string
  classe?: string
  assuntos: string[]
  orgaoJulgador?: string
  dataAjuizamento?: string
  tribunal?: string
  grau?: string
  ultimoMovimento?: { nome: string; data?: string }
}

const TINTA: Record<FaseJudicial, { barra: string; texto: string; fundo: string }> = {
  TRIAGEM: {
    barra: "bg-slate-400",
    texto: "text-slate-700 dark:text-slate-300",
    fundo: "bg-slate-50/80 dark:bg-slate-900/40",
  },
  PROTOCOLADA: {
    barra: "bg-blue-600",
    texto: "text-blue-700 dark:text-blue-300",
    fundo: "bg-blue-50/70 dark:bg-blue-950/25",
  },
  PERICIA: {
    barra: "bg-amber-500",
    texto: "text-amber-700 dark:text-amber-300",
    fundo: "bg-amber-50/80 dark:bg-amber-950/25",
  },
  SENTENCA: {
    barra: "bg-violet-600",
    texto: "text-violet-700 dark:text-violet-300",
    fundo: "bg-violet-50/70 dark:bg-violet-950/25",
  },
  ENCERRADA: {
    barra: "bg-emerald-600",
    texto: "text-emerald-700 dark:text-emerald-300",
    fundo: "bg-emerald-50/70 dark:bg-emerald-950/25",
  },
}

const TOM_STATUS: Record<string, string> = {
  EM_ANALISE: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  AGUARDANDO_INSS: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  PERICIA_MARCADA: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  PERICIA_CONCLUIDA: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  BENEFICIO_CONCEDIDO:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  RECUSADO: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
  CONCLUIDO: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  ARQUIVADO: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
}

function formatarData(iso?: string | null) {
  if (!iso) return null
  return iso.slice(0, 10).split("-").reverse().join("/")
}

/** Número CNJ na máscara oficial: NNNNNNN-DD.AAAA.J.TR.OOOO. */
function formatarCnj(numero?: string | null) {
  if (!numero) return null
  const d = numero.replace(/\D/g, "")
  if (d.length !== 20) return numero
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`
}

function MenuFase({
  status,
  onTrocar,
}: {
  status: string
  onTrocar: (status: string) => Promise<void>
}) {
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return

    const aoClicar = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false)
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false)
    }

    document.addEventListener("mousedown", aoClicar)
    document.addEventListener("keydown", aoTeclar)
    return () => {
      document.removeEventListener("mousedown", aoClicar)
      document.removeEventListener("keydown", aoTeclar)
    }
  }, [aberto])

  async function escolher(novo: string) {
    setAberto(false)
    setSalvando(true)
    try {
      await onTrocar(novo)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title="Trocar fase"
        className={cn(
          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          TOM_STATUS[status] ?? TOM_STATUS.EM_ANALISE
        )}
      >
        {salvando ? <Loader2 size={11} className="animate-spin" /> : null}
        {STATUS_LABEL_JUDICIAL[status as keyof typeof STATUS_LABEL_JUDICIAL] ?? status}
        <ChevronDown size={11} strokeWidth={2.5} />
      </button>

      {aberto && (
        <div
          role="menu"
          className="animate-in fade-in slide-in-from-top-1 absolute left-0 z-40 mt-1.5 w-52 rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-150"
        >
          {STATUS_JUDICIAIS.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              onClick={() => escolher(s)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-accent hover:text-accent-foreground"
            >
              <span className="flex-1">{STATUS_LABEL_JUDICIAL[s]}</span>
              {s === status ? <Check size={14} /> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PainelDataJud({
  numero,
  onRegistrar,
}: {
  numero: string
  onRegistrar: (descricao: string, data?: string) => Promise<void>
}) {
  const [dados, setDados] = useState<DadosDataJud | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [consultando, setConsultando] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [registrado, setRegistrado] = useState(false)

  async function consultar() {
    setConsultando(true)
    setErro(null)
    setRegistrado(false)
    try {
      const r = await fetch(
        `/api/processos/lookup?numero=${encodeURIComponent(numero)}`
      )
      const json = await r.json()
      if (!r.ok) throw new Error(json.error ?? "Não foi possível consultar")
      setDados(json.dados)
    } catch (e) {
      setDados(null)
      setErro(e instanceof Error ? e.message : "Não foi possível consultar")
    } finally {
      setConsultando(false)
    }
  }

  async function registrar() {
    if (!dados?.ultimoMovimento) return
    setRegistrando(true)
    try {
      await onRegistrar(
        `DataJud: ${dados.ultimoMovimento.nome}`,
        dados.ultimoMovimento.data
      )
      setRegistrado(true)
    } finally {
      setRegistrando(false)
    }
  }

  return (
    <div className="mt-2 border-t border-foreground/10 pt-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={consultar}
        disabled={consultando}
        className="h-7 w-full justify-start px-1.5 text-[11.5px]"
      >
        {consultando ? (
          <Loader2 size={12} className="mr-1.5 animate-spin" />
        ) : (
          <RefreshCw size={12} className="mr-1.5" />
        )}
        Consultar DataJud
      </Button>

      {erro ? (
        <p className="mt-1 text-[11px] leading-snug text-destructive">{erro}</p>
      ) : null}

      {dados ? (
        <div className="mt-1.5 space-y-1 rounded-md bg-muted/60 p-2 text-[11px] leading-snug">
          {dados.classe ? (
            <p>
              <span className="text-muted-foreground">Classe: </span>
              {dados.classe}
            </p>
          ) : null}
          {dados.orgaoJulgador ? (
            <p>
              <span className="text-muted-foreground">Órgão: </span>
              {dados.orgaoJulgador}
            </p>
          ) : null}
          {dados.assuntos.length > 0 ? (
            <p>
              <span className="text-muted-foreground">Assunto: </span>
              {dados.assuntos[0]}
            </p>
          ) : null}
          {dados.ultimoMovimento ? (
            <>
              <p>
                <span className="text-muted-foreground">Último movimento: </span>
                {dados.ultimoMovimento.nome}
                {dados.ultimoMovimento.data
                  ? ` — ${formatarData(dados.ultimoMovimento.data)}`
                  : ""}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={registrar}
                disabled={registrando || registrado}
                className="mt-1 h-7 px-2 text-[11px]"
              >
                {registrando ? (
                  <Loader2 size={11} className="mr-1 animate-spin" />
                ) : registrado ? (
                  <Check size={11} className="mr-1" />
                ) : null}
                {registrado ? "Registrado" : "Registrar como andamento"}
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">Sem movimentos publicados.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function CartaoJudicial({
  item,
  onTrocarStatus,
  onRegistrarAndamento,
}: {
  item: ItemJudicial
  onTrocarStatus: (status: string) => Promise<void>
  onRegistrarAndamento: (descricao: string, data?: string) => Promise<void>
}) {
  const [copiado, setCopiado] = useState(false)
  const cnj = formatarCnj(item.numero)
  const juizo = [item.vara, item.comarca ?? item.tribunal].filter(Boolean).join(" · ")

  return (
    <div className="relative rounded-lg bg-card p-2.5 ring-1 ring-foreground/10 has-[[aria-expanded=true]]:z-30">
      <Link
        href={`/clientes/${item.clienteId}`}
        className="group flex items-start gap-1 text-[13px] leading-tight font-semibold hover:underline"
      >
        <span className="min-w-0 flex-1 truncate">{item.cliente}</span>
        <ArrowUpRight
          size={13}
          className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </Link>

      <p className="mt-0.5 truncate text-[11.5px] leading-tight text-muted-foreground">
        {item.beneficio}
      </p>

      {cnj ? (
        <div className="mt-1.5 flex items-center gap-1">
          <span className="truncate font-mono text-[11px] select-all">{cnj}</span>
          <button
            type="button"
            aria-label="Copiar número do processo"
            title="Copiar número"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(cnj)
                setCopiado(true)
                window.setTimeout(() => setCopiado(false), 1500)
              } catch {
                // Sem permissão de área de transferência: o número está
                // à vista e é selecionável.
              }
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {copiado ? (
              <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy size={11} />
            )}
          </button>
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground italic">
          sem número CNJ — ainda não distribuída
        </p>
      )}

      {juizo ? (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">{juizo}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <MenuFase status={item.status} onTrocar={onTrocarStatus} />
      </div>

      {item.ultimoAndamento ? (
        <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground/70">
            {formatarData(item.ultimoAndamento.data)}
          </span>{" "}
          {item.ultimoAndamento.descricao}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground italic">
          nenhum andamento registrado
        </p>
      )}

      {item.numero ? (
        <PainelDataJud numero={item.numero} onRegistrar={onRegistrarAndamento} />
      ) : null}
    </div>
  )
}

export function QuadroJudicial({
  itens,
  onTrocarStatus,
  onRegistrarAndamento,
}: {
  itens: ItemJudicial[]
  onTrocarStatus: (processoId: string, status: string) => Promise<void>
  onRegistrarAndamento: (
    processoId: string,
    descricao: string,
    data?: string
  ) => Promise<void>
}) {
  const porFase = Object.fromEntries(
    FASES_JUDICIAIS.map((f) => [f, [] as ItemJudicial[]])
  ) as Record<FaseJudicial, ItemJudicial[]>

  for (const item of itens) {
    porFase[faseDoStatus(item.status)].push(item)
  }

  for (const fase of FASES_JUDICIAIS) {
    porFase[fase].sort((a, b) => a.cliente.localeCompare(b.cliente))
  }

  return (
    <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {FASES_JUDICIAIS.map((fase) => {
        const tinta = TINTA[fase]
        const lista = porFase[fase]

        return (
          <section
            key={fase}
            className={cn(
              "flex flex-col rounded-xl ring-1 ring-foreground/10 ring-inset",
              tinta.fundo
            )}
          >
            <span
              aria-hidden
              className={cn("h-1.5 w-full shrink-0 rounded-t-xl", tinta.barra)}
            />

            <header className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <h3
                  className={cn(
                    "font-heading flex-1 truncate text-[13px] leading-tight font-bold tracking-wide uppercase",
                    tinta.texto
                  )}
                >
                  {FASE_LABEL[fase]}
                </h3>
                <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1 ring-foreground/10">
                  {lista.length}
                </span>
              </div>
              <p className="mt-0.5 text-[10.5px] leading-tight text-muted-foreground">
                {FASE_DESCRICAO[fase]}
              </p>
            </header>

            <div className="flex flex-col gap-2 px-2.5 pb-2.5">
              {lista.map((item) => (
                <CartaoJudicial
                  key={item.id}
                  item={item}
                  onTrocarStatus={(s) => onTrocarStatus(item.id, s)}
                  onRegistrarAndamento={(d, data) =>
                    onRegistrarAndamento(item.id, d, data)
                  }
                />
              ))}

              {lista.length === 0 && (
                <p className="flex items-center justify-center gap-1.5 py-4 text-center text-[11px] text-muted-foreground">
                  {fase === "SENTENCA" ? (
                    <Gavel size={12} />
                  ) : (
                    <Scale size={12} />
                  )}
                  Nenhuma ação nesta fase
                </p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
