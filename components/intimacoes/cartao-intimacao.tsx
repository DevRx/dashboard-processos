"use client"

import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  ExternalLink,
  ListPlus,
  Loader2,
  Sparkles,
  Undo2,
  UserCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  TIMES_TAREFA,
  TIME_LABEL,
  TIME_LABEL_CURTO,
  type TimeTarefa,
} from "@/lib/domain/tarefa"

export type Intimacao = {
  id: string
  djen_id: string | number
  numero_processo: string | null
  numero_processo_mascara: string | null
  sigla_tribunal: string | null
  nome_orgao: string | null
  tipo_comunicacao: string | null
  tipo_documento: string | null
  nome_classe: string | null
  destinatario: string | null
  data_disponibilizacao: string
  texto: string
  link: string | null
  prazo_dias: number | null
  prazo_trecho: string | null
  prazo_estimado: string | null
  processo_id: string | null
  tarefa_id: string | null
  tratada_em: string | null
  ia_tipo_ato: string | null
  ia_resumo: string | null
  ia_providencia: string | null
  ia_urgencia: string | null
  ia_prazo_de_quem: string | null
  ia_alertas: string[] | null
  ia_analisada_em: string | null
  tarefa?: { id: string; setor: string | null; status: string } | null
  processo?: {
    id: string
    numero: string | null
    cliente?: { id: string; nome: string } | null
  } | null
}

export type Usuario = { id: string; name: string }

/** Mesmas cores do quadro de tarefas: o time é reconhecido pela cor. */
const COR_TIME: Record<TimeTarefa, string> = {
  VERMELHO: "bg-red-600",
  PRETO: "bg-zinc-900 dark:bg-zinc-100",
  AZUL: "bg-blue-600",
  AMARELO: "bg-amber-400",
  VERDE: "bg-emerald-600",
}

const TOM_URGENCIA: Record<string, string> = {
  ALTA: "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-200",
  MEDIA: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200",
  BAIXA: "bg-muted text-muted-foreground",
}

/**
 * Mini-relatório da leitura por IA.
 *
 * Fica acima do texto do diário porque é o que se lê primeiro: do que
 * se trata, o que fazer e de quem é o prazo. O texto original continua
 * a um clique, e nada aqui substitui a conferência — é triagem.
 */
function LeituraIA({
  intimacao,
  analisando,
  onAnalisar,
}: {
  intimacao: Intimacao
  analisando: boolean
  onAnalisar: () => Promise<void>
}) {
  if (!intimacao.ia_analisada_em) {
    return (
      <div className="flex items-center gap-2 border-t border-foreground/5 px-3.5 py-2">
        <button
          type="button"
          onClick={onAnalisar}
          disabled={analisando}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-primary transition-colors hover:bg-accent disabled:opacity-60 dark:text-blue-400"
        >
          {analisando ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {analisando ? "Lendo a publicação…" : "Ler com IA"}
        </button>
      </div>
    )
  }

  const daOutraParte = intimacao.ia_prazo_de_quem === "OUTRA_PARTE"
  const alertas = intimacao.ia_alertas ?? []

  return (
    <div className="border-t border-foreground/5 bg-accent/40 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold tracking-wide text-primary uppercase dark:text-blue-400">
          <Sparkles size={11} />
          Leitura por IA
        </span>

        {intimacao.ia_tipo_ato ? (
          <span className="rounded bg-card px-1.5 py-0.5 text-[10.5px] font-semibold shadow-card">
            {intimacao.ia_tipo_ato}
          </span>
        ) : null}

        {intimacao.ia_urgencia ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide uppercase",
              TOM_URGENCIA[intimacao.ia_urgencia] ?? TOM_URGENCIA.BAIXA
            )}
          >
            {intimacao.ia_urgencia}
          </span>
        ) : null}

        {daOutraParte ? (
          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-violet-800 uppercase dark:bg-violet-950/70 dark:text-violet-200">
            prazo de outra parte
          </span>
        ) : null}

        <button
          type="button"
          onClick={onAnalisar}
          disabled={analisando}
          title="Ler de novo"
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {analisando ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Sparkles size={11} />
          )}
          reler
        </button>
      </div>

      {intimacao.ia_resumo ? (
        <p className="mt-1.5 text-[12.5px] leading-snug">{intimacao.ia_resumo}</p>
      ) : null}

      {intimacao.ia_providencia ? (
        <p className="mt-1 text-[12.5px] leading-snug">
          <span className="font-semibold">Fazer: </span>
          {intimacao.ia_providencia}
        </p>
      ) : null}

      {alertas.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {alertas.map((alerta) => (
            <li
              key={alerta}
              className="flex items-start gap-1.5 text-[11.5px] leading-snug text-amber-800 dark:text-amber-300"
            >
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              {alerta}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function formatarData(iso?: string | null) {
  if (!iso) return null
  return iso.slice(0, 10).split("-").reverse().join("/")
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Dias corridos até o prazo — negativo quando já passou. */
function diasAte(iso: string) {
  const alvo = new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime()
  const hoje = new Date(`${hojeISO()}T12:00:00Z`).getTime()
  return Math.round((alvo - hoje) / 86_400_000)
}

export function CartaoIntimacao({
  intimacao,
  usuarios,
  onCriarTarefa,
  onAlternarTratada,
  onDirecionar,
  onAnalisar,
}: {
  intimacao: Intimacao
  usuarios: Usuario[]
  onCriarTarefa: (dados: {
    data: string
    responsavelId: string | null
    setor: TimeTarefa | null
  }) => Promise<void>
  onAlternarTratada: (tratada: boolean) => Promise<void>
  /** Direciona a intimação a um time: move a tarefa ou já a cria lá. */
  onDirecionar: (time: TimeTarefa) => Promise<void>
  onAnalisar: () => Promise<void>
}) {
  const [aberta, setAberta] = useState(false)
  const [criando, setCriando] = useState(false)
  const [formAberto, setFormAberto] = useState(false)
  const [data, setData] = useState(intimacao.prazo_estimado ?? hojeISO())
  const [responsavelId, setResponsavelId] = useState("")
  const [time, setTime] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [direcionando, setDirecionando] = useState<string | null>(null)

  const tratada = Boolean(intimacao.tratada_em)
  const dias = intimacao.prazo_estimado ? diasAte(intimacao.prazo_estimado) : null
  const urgente = dias !== null && dias <= 3

  async function criar() {
    setCriando(true)
    try {
      await onCriarTarefa({
        data,
        responsavelId: responsavelId || null,
        setor: (time || null) as TimeTarefa | null,
      })
      setFormAberto(false)
    } finally {
      setCriando(false)
    }
  }

  return (
    <article
      className={cn(
        "rounded-xl bg-card shadow-card transition-opacity",
        tratada && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-accent px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-accent-foreground uppercase">
              {intimacao.sigla_tribunal ?? "—"}
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {intimacao.tipo_documento ?? intimacao.tipo_comunicacao ?? "Comunicação"}
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              · publicada em {formatarData(intimacao.data_disponibilizacao)}
            </span>
          </div>

          <p className="mt-1 text-[13.5px] leading-tight font-semibold">
            {intimacao.destinatario ?? "Parte não identificada no diário"}
          </p>

          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
            {intimacao.nome_orgao}
            {intimacao.numero_processo_mascara
              ? ` · ${intimacao.numero_processo_mascara}`
              : ""}
          </p>

          {intimacao.processo ? (
            <Link
              href={`/clientes/${intimacao.processo.cliente?.id ?? ""}`}
              className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline dark:text-blue-400"
            >
              <Check size={12} />
              {intimacao.processo.cliente?.nome ?? "processo vinculado"}
            </Link>
          ) : (
            <p className="mt-1 text-[11.5px] text-muted-foreground italic">
              sem processo cadastrado com este número
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {intimacao.prazo_dias ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold",
                urgente
                  ? "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
              )}
              title="Estimativa em dias úteis, sem feriados. Confira no processo."
            >
              {urgente ? <AlertTriangle size={12} /> : <CalendarClock size={12} />}
              {intimacao.prazo_dias} dias · até{" "}
              {formatarData(intimacao.prazo_estimado)}
              {dias !== null && (
                <span className="font-normal">
                  ({dias < 0 ? `venceu há ${-dias}d` : `faltam ${dias}d`})
                </span>
              )}
            </span>
          ) : (
            <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
              sem prazo explícito
            </span>
          )}

          <div className="flex items-center gap-1">
            {intimacao.link ? (
              <a
                href={intimacao.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ExternalLink size={12} />
                Abrir no PJe
              </a>
            ) : null}

            <button
              type="button"
              onClick={async () => {
                setSalvando(true)
                try {
                  await onAlternarTratada(!tratada)
                } finally {
                  setSalvando(false)
                }
              }}
              disabled={salvando}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium transition-colors",
                tratada
                  ? "text-muted-foreground hover:bg-accent"
                  : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
              )}
            >
              {salvando ? (
                <Loader2 size={12} className="animate-spin" />
              ) : tratada ? (
                <Undo2 size={12} />
              ) : (
                <Check size={12} />
              )}
              {tratada ? "Reabrir" : "Tratada"}
            </button>
          </div>
        </div>
      </div>

      {intimacao.prazo_trecho ? (
        <p className="border-t border-foreground/5 px-3.5 py-2 text-[11.5px] leading-snug text-muted-foreground italic">
          {intimacao.prazo_trecho}
        </p>
      ) : null}

      <LeituraIA
        intimacao={intimacao}
        analisando={analisando}
        onAnalisar={async () => {
          setAnalisando(true)
          try {
            await onAnalisar()
          } finally {
            setAnalisando(false)
          }
        }}
      />

      {/* Direcionar é o gesto mais repetido da triagem: fica numa
          linha própria, sem menu e sem formulário. */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-foreground/5 px-3.5 py-2">
        <span className="mr-0.5 inline-flex items-center gap-1 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
          <UserCheck size={12} />
          Time
        </span>

        {TIMES_TAREFA.map((t) => {
          const atual = intimacao.tarefa?.setor === t
          return (
            <button
              key={t}
              type="button"
              disabled={direcionando !== null}
              title={
                intimacao.tarefa_id
                  ? `Mover a tarefa para o ${TIME_LABEL[t]}`
                  : `Criar a tarefa já no ${TIME_LABEL[t]}`
              }
              onClick={async () => {
                setDirecionando(t)
                try {
                  await onDirecionar(t)
                } finally {
                  setDirecionando(null)
                }
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ring-1 transition-colors",
                atual
                  ? "bg-foreground/5 ring-foreground/25"
                  : "ring-foreground/10 hover:bg-accent",
                direcionando !== null && "opacity-60"
              )}
            >
              {direcionando === t ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <span className={cn("size-2.5 rounded-full", COR_TIME[t])} />
              )}
              {TIME_LABEL_CURTO[t]}
              {atual ? <Check size={11} /> : null}
            </button>
          )
        })}

        {intimacao.tarefa?.setor ? null : intimacao.tarefa_id ? (
          <span className="text-[11px] text-muted-foreground">
            tarefa criada, ainda sem time
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-foreground/5 px-3.5 py-2">
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          aria-expanded={aberta}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            size={13}
            className={cn("transition-transform", aberta && "rotate-180")}
          />
          {aberta ? "Ocultar" : "Ler"} publicação
        </button>

        {intimacao.tarefa_id ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-700 dark:text-emerald-300">
            <Check size={12} />
            prazo na lista de tarefas
          </span>
        ) : (
          <Button
            size="sm"
            variant={formAberto ? "secondary" : "outline"}
            onClick={() => setFormAberto((v) => !v)}
            className="ml-auto h-7 px-2 text-[11.5px]"
          >
            <ListPlus size={12} className="mr-1" />
            Criar tarefa do prazo
          </Button>
        )}
      </div>

      {formAberto && !intimacao.tarefa_id && (
        <div className="animate-in fade-in slide-in-from-top-1 flex flex-wrap items-end gap-2 border-t border-foreground/5 bg-muted/40 px-3.5 py-2.5 duration-150">
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Prazo
            </span>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-8 w-[150px] text-[12.5px]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Responsável
            </span>
            <select
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              className="h-8 rounded-lg border border-input bg-card px-2.5 text-[12.5px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
            >
              <option value="">Sem responsável</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Time
            </span>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-8 rounded-lg border border-input bg-card px-2.5 text-[12.5px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
            >
              <option value="">Sem time</option>
              {TIMES_TAREFA.map((t) => (
                <option key={t} value={t}>
                  {TIME_LABEL[t]}
                </option>
              ))}
            </select>
          </label>

          <Button size="sm" onClick={criar} disabled={criando} className="h-8">
            {criando ? <Loader2 size={13} className="animate-spin" /> : null}
            Criar tarefa
          </Button>
        </div>
      )}

      {aberta && (
        <div className="animate-in fade-in max-h-72 overflow-y-auto border-t border-foreground/10 bg-muted/40 px-3.5 py-3 text-[12px] leading-relaxed whitespace-pre-line duration-150">
          {intimacao.texto}
        </div>
      )}
    </article>
  )
}
