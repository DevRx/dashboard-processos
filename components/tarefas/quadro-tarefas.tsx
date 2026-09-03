"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, Check, CircleHelp, Loader2, Plus, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PainelTarefa } from "./painel-tarefa"
import { cn } from "@/lib/utils"
import {
  TIMES_TAREFA,
  TIME_LABEL,
  TIME_LABEL_CURTO,
  isTimeTarefa,
  type TimeTarefa,
} from "@/lib/domain/tarefa"

/**
 * Quadro de tarefas por time.
 *
 * A pergunta que ele responde é "de quem é isso?", e a resposta chega
 * pela cor da coluna antes de qualquer leitura. Dentro do cartão, o
 * responsável vem primeiro e em negrito pelo mesmo motivo: quem está
 * varrendo o quadro procura um nome, não um título de tarefa.
 *
 * O campo continua se chamando `setor` no banco e na API; na tela, o
 * nome é time — ver lib/domain/tarefa/time.ts.
 */

type Responsavel = { id: string; name: string }

type Tarefa = {
  id: string
  titulo: string
  data: string
  hora: string | null
  status: string
  prioridade: string
  setor: string | null
  responsavelId: string | null
  responsavel: Responsavel | null
  processo: { beneficio: string; numero: string | null } | null
  tipo?: string | null
  tarefaPaiId?: string | null
  resposta?: string | null
}

type Usuario = { id: string; name: string; role: string }

/** Cores dos times. Fortes de propósito: são o índice do quadro. */
const CORES: Record<
  TimeTarefa,
  { faixa: string; cabecalho: string; ponto: string; fundo: string }
> = {
  VERMELHO: {
    faixa: "bg-red-600",
    cabecalho: "text-red-700 dark:text-red-300",
    ponto: "bg-red-600",
    fundo: "bg-red-50/70 dark:bg-red-950/25",
  },
  PRETO: {
    faixa: "bg-zinc-900 dark:bg-zinc-100",
    cabecalho: "text-zinc-900 dark:text-zinc-100",
    ponto: "bg-zinc-900 dark:bg-zinc-100",
    fundo: "bg-zinc-100/80 dark:bg-zinc-900/50",
  },
  AZUL: {
    faixa: "bg-blue-600",
    cabecalho: "text-blue-700 dark:text-blue-300",
    ponto: "bg-blue-600",
    fundo: "bg-blue-50/70 dark:bg-blue-950/25",
  },
  AMARELO: {
    faixa: "bg-amber-400",
    cabecalho: "text-amber-700 dark:text-amber-300",
    ponto: "bg-amber-400",
    fundo: "bg-amber-50/80 dark:bg-amber-950/25",
  },
  VERDE: {
    faixa: "bg-emerald-600",
    cabecalho: "text-emerald-700 dark:text-emerald-300",
    ponto: "bg-emerald-600",
    fundo: "bg-emerald-50/70 dark:bg-emerald-950/25",
  },
}

const PRIORIDADE_TOM: Record<string, string> = {
  URGENTE: "bg-red-600 text-white",
  ALTA: "bg-amber-500 text-white",
  MEDIA: "bg-muted text-muted-foreground",
  BAIXA: "bg-muted text-muted-foreground",
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ""
  return (primeira + ultima).toUpperCase()
}

/**
 * "Maria Aparecida Souza" não cabe na largura de uma coluna, e cortar
 * no meio ("Maria Apareci…") identifica menos que abreviar. O nome
 * inteiro fica no `title` e nas iniciais do avatar.
 */
function nomeCurto(nome: string) {
  if (nome.length <= 14) return nome

  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 1) return partes[0]

  return `${partes[0]} ${partes[partes.length - 1][0]}.`
}

function formatarData(iso?: string | null) {
  if (!iso) return null
  return iso.slice(0, 10).split("-").reverse().join("/")
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Menu genérico ancorado a um gatilho, usado para time e responsável. */
function MenuSuspenso({
  gatilho,
  titulo,
  children,
}: {
  gatilho: (aberto: boolean) => React.ReactNode
  titulo: string
  children: (fechar: () => void) => React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={titulo}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        {gatilho(aberto)}
      </button>

      {aberto && (
        <div
          role="menu"
          className="animate-in fade-in slide-in-from-top-1 absolute right-0 z-40 mt-1.5 max-h-64 w-56 overflow-y-auto rounded-xl bg-popover p-1.5 text-popover-foreground shadow-float duration-150"
        >
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  )
}

function CartaoTarefa({
  tarefa,
  usuarios,
  arrastando,
  onArrastarInicio,
  onArrastarFim,
  onTrocarTime,
  onTrocarResponsavel,
  onConcluir,
  onAbrir,
}: {
  tarefa: Tarefa
  usuarios: Usuario[]
  arrastando: boolean
  onArrastarInicio: () => void
  onArrastarFim: () => void
  onTrocarTime: (time: TimeTarefa | null) => void
  onTrocarResponsavel: (responsavelId: string | null) => void
  onConcluir: () => void
  onAbrir: () => void
}) {
  const prazo = formatarData(tarefa.data)
  const atrasada = tarefa.data.slice(0, 10) < hojeISO()
  const responsavel = tarefa.responsavel

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", tarefa.id)
        e.dataTransfer.effectAllowed = "move"
        onArrastarInicio()
      }}
      onDragEnd={onArrastarFim}
      className={cn(
        "relative cursor-grab rounded-xl bg-card p-3 shadow-card transition-[opacity,box-shadow,transform] hover:shadow-float active:cursor-grabbing has-[[aria-expanded=true]]:z-30",
        arrastando && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        {/* O responsável abre o cartão: é o dado mais procurado aqui. */}
        <MenuSuspenso titulo="Trocar responsável" gatilho={() => (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold",
              responsavel
                ? "bg-gradient-brand text-white shadow-[0_3px_10px_-3px_rgba(219,39,119,0.6)]"
                : "bg-muted text-muted-foreground"
            )}
          >
            {responsavel ? iniciais(responsavel.name) : <UserRound size={13} />}
          </span>
        )}>
          {(fechar) => (
            <>
              {usuarios.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onTrocarResponsavel(u.id)
                    fechar()
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9.5px] font-bold">
                    {iniciais(u.name)}
                  </span>
                  <span className="flex-1 truncate">{u.name}</span>
                  {u.id === tarefa.responsavelId ? <Check size={14} /> : null}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onTrocarResponsavel(null)
                  fechar()
                }}
                className="w-full rounded-md px-2.5 py-2 text-left text-[13px] text-muted-foreground hover:bg-accent"
              >
                Sem responsável
              </button>
            </>
          )}
        </MenuSuspenso>

        <div className="min-w-0 flex-1">
          <p
            title={responsavel?.name}
            className="truncate text-[12.5px] leading-tight font-bold"
          >
            {responsavel ? nomeCurto(responsavel.name) : "Sem responsável"}
          </p>
          {/* O título abre a tarefa: é onde moram as dúvidas e o
              histórico. Botão e não div com onClick — a tarefa precisa
              abrir pelo teclado como abre pelo mouse. */}
          <button
            type="button"
            onClick={onAbrir}
            className="mt-0.5 flex w-full items-start gap-1 rounded text-left text-[12.5px] leading-snug text-foreground/90 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {tarefa.tipo === "DUVIDA" ? (
              <CircleHelp
                size={12}
                strokeWidth={2.2}
                aria-label="dúvida"
                className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              />
            ) : null}
            <span className="min-w-0 flex-1">{tarefa.titulo}</span>
          </button>
        </div>

      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {prazo ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              atrasada && tarefa.status !== "CONCLUIDA"
                ? "bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300"
                : "bg-muted text-muted-foreground"
            )}
          >
            <CalendarClock size={11} />
            {prazo}
            {tarefa.hora ? ` ${tarefa.hora}` : ""}
          </span>
        ) : null}

        {tarefa.prioridade !== "MEDIA" && tarefa.prioridade !== "BAIXA" ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wide uppercase",
              PRIORIDADE_TOM[tarefa.prioridade] ?? PRIORIDADE_TOM.MEDIA
            )}
          >
            {tarefa.prioridade}
          </span>
        ) : null}

        <MenuSuspenso titulo="Trocar time" gatilho={() => (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
            <span
              className={cn(
                "size-2 rounded-full",
                isTimeTarefa(tarefa.setor)
                  ? CORES[tarefa.setor].ponto
                  : "bg-muted-foreground/40"
              )}
            />
            {isTimeTarefa(tarefa.setor)
              ? TIME_LABEL_CURTO[tarefa.setor]
              : "sem time"}
          </span>
        )}>
          {(fechar) => (
            <>
              {TIMES_TAREFA.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onTrocarTime(s)
                    fechar()
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-accent hover:text-accent-foreground"
                >
                  <span className={cn("size-2.5 rounded-full", CORES[s].ponto)} />
                  <span className="flex-1">{TIME_LABEL[s]}</span>
                  {s === tarefa.setor ? <Check size={14} /> : null}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onTrocarTime(null)
                  fechar()
                }}
                className="w-full rounded-md px-2.5 py-2 text-left text-[13px] text-muted-foreground hover:bg-accent"
              >
                Tirar do time
              </button>
            </>
          )}
        </MenuSuspenso>

        {/* Concluir mora no rodapé para o nome do responsável ficar
            com a largura inteira do cartão lá em cima. */}
        <button
          type="button"
          onClick={onConcluir}
          title="Marcar como concluída"
          aria-label={`Concluir tarefa ${tarefa.titulo}`}
          className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-300"
        >
          <Check size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

function NovaTarefa({
  time,
  usuarios,
  onCriar,
}: {
  time: TimeTarefa
  usuarios: Usuario[]
  onCriar: (dados: {
    titulo: string
    setor: TimeTarefa
    responsavelId: string | null
    data: string
  }) => Promise<void>
}) {
  const [aberto, setAberto] = useState(false)
  const [titulo, setTitulo] = useState("")
  const [responsavelId, setResponsavelId] = useState("")
  const [data, setData] = useState(hojeISO())
  const [salvando, setSalvando] = useState(false)

  async function criar() {
    if (!titulo.trim()) return
    setSalvando(true)
    try {
      await onCriar({
        titulo: titulo.trim(),
        setor: time,
        responsavelId: responsavelId || null,
        data,
      })
      setTitulo("")
      setAberto(false)
    } finally {
      setSalvando(false)
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-foreground/15 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card/60 hover:text-primary"
      >
        <Plus size={13} />
        Nova tarefa
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-float">
      <Input
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") criar()
          if (e.key === "Escape") setAberto(false)
        }}
        placeholder="O que precisa ser feito"
        className="h-8 text-sm"
      />

      <div className="flex gap-1.5">
        <select
          value={responsavelId}
          onChange={(e) => setResponsavelId(e.target.value)}
          aria-label="Responsável"
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-card px-2.5 text-[12.5px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
        >
          <option value="">Sem responsável</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          aria-label="Data"
          className="h-8 shrink-0 rounded-lg border border-input bg-card px-2.5 text-[12.5px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
        />
      </div>

      <div className="flex gap-1.5">
        <Button size="sm" onClick={criar} disabled={salvando || !titulo.trim()}>
          {salvando ? <Loader2 size={13} className="animate-spin" /> : null}
          Criar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

export function QuadroTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null)
  const [aberta, setAberta] = useState<Tarefa | null>(null)

  useEffect(() => {
    const lista = fetch("/api/tarefas")
      .then((r) => (r.ok ? r.json() : { tarefas: [] }))
      .then((d) => setTarefas(d.tarefas ?? []))

    const equipe = fetch("/api/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsuarios(d.users ?? []))

    Promise.all([lista, equipe])
      .catch((err) => console.error("Erro ao carregar tarefas:", err))
      .finally(() => setCarregando(false))
  }, [])

  /**
   * Abrir ou responder uma dúvida mexe no quadro de fora do quadro:
   * nasce um cartão, ou some um. Recarregar a lista inteira é mais
   * barato que costurar o caso na mão e errar um deles.
   */
  const recarregar = useCallback(() => {
    fetch("/api/tarefas")
      .then((r) => (r.ok ? r.json() : { tarefas: [] }))
      .then((d) => setTarefas(d.tarefas ?? []))
      .catch((err) => console.error("Erro ao recarregar tarefas:", err))
  }, [])

  const patch = useCallback(
    async (id: string, campos: Record<string, unknown>) => {
      const r = await fetch(`/api/tarefas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campos),
      })

      if (!r.ok) return
      const { tarefa } = await r.json()

      setTarefas((atuais) =>
        atuais.map((t) => (t.id === id ? { ...t, ...tarefa } : t))
      )
    },
    []
  )

  const criar = useCallback(
    async (dados: {
      titulo: string
      setor: TimeTarefa
      responsavelId: string | null
      data: string
    }) => {
      const r = await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      })

      if (!r.ok) return
      const { tarefa } = await r.json()
      setTarefas((atuais) => [...atuais, tarefa])
    },
    []
  )

  /**
   * Soltar um cartão numa coluna é a mesma edição do menu de time —
   * só que sem menu. A tarefa muda de lugar na hora e o servidor
   * confirma depois; se recusar, o `patch` devolve o estado do banco.
   */
  const soltar = useCallback(
    (e: React.DragEvent, setor: TimeTarefa | null) => {
      e.preventDefault()
      setColunaAlvo(null)
      setArrastando(null)

      const id = e.dataTransfer.getData("text/plain")
      if (!id) return

      setTarefas((atuais) =>
        atuais.map((t) => (t.id === id ? { ...t, setor } : t))
      )
      patch(id, { setor })
    },
    [patch]
  )

  // Concluída sai do quadro: quadro é o que falta fazer.
  const emAberto = useMemo(
    () => tarefas.filter((t) => t.status !== "CONCLUIDA" && t.status !== "CANCELADA"),
    [tarefas]
  )

  const porTime = useMemo(() => {
    const mapa = Object.fromEntries(
      TIMES_TAREFA.map((s) => [s, [] as Tarefa[]])
    ) as Record<TimeTarefa, Tarefa[]>
    const semTime: Tarefa[] = []

    for (const t of emAberto) {
      if (isTimeTarefa(t.setor)) mapa[t.setor].push(t)
      else semTime.push(t)
    }

    for (const s of TIMES_TAREFA) {
      mapa[s].sort((a, b) => a.data.localeCompare(b.data))
    }

    return { mapa, semTime }
  }, [emAberto])

  if (carregando) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {TIMES_TAREFA.map((time) => {
          const cor = CORES[time]
          const lista = porTime.mapa[time]

          const alvo = colunaAlvo === time

          return (
            <section
              key={time}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                setColunaAlvo(time)
              }}
              onDragLeave={() =>
                setColunaAlvo((c) => (c === time ? null : c))
              }
              onDrop={(e) => soltar(e, time)}
              className={cn(
                "flex flex-col overflow-visible rounded-2xl shadow-card transition-shadow",
                cor.fundo,
                // Enquanto se arrasta, a coluna sob o cursor levanta a
                // mão: sem isso, soltar vira aposta.
                alvo && "shadow-md ring-2 ring-foreground/30"
              )}
            >
              <span
                aria-hidden
                className={cn("h-1.5 w-full shrink-0 rounded-t-2xl", cor.faixa)}
              />

              <header className="flex items-center gap-2 px-3 py-2.5">
                <h3
                  className={cn(
                    "font-heading flex-1 truncate text-[13px] leading-tight font-bold tracking-wide uppercase",
                    cor.cabecalho
                  )}
                >
                  {TIME_LABEL[time]}
                </h3>
                <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] font-bold tabular-nums shadow-card">
                  {lista.length}
                </span>
              </header>

              <div className="flex min-h-[72px] flex-col gap-2 px-2.5 pb-2.5">
                {lista.map((t) => (
                  <CartaoTarefa
                    key={t.id}
                    tarefa={t}
                    usuarios={usuarios}
                    arrastando={arrastando === t.id}
                    onArrastarInicio={() => setArrastando(t.id)}
                    onArrastarFim={() => setArrastando(null)}
                    onTrocarTime={(s) => patch(t.id, { setor: s })}
                    onTrocarResponsavel={(r) => patch(t.id, { responsavelId: r })}
                    onConcluir={() => patch(t.id, { status: "CONCLUIDA" })}
                    onAbrir={() => setAberta(t)}
                  />
                ))}

                {lista.length === 0 && arrastando && (
                  <p className="rounded-lg border border-dashed border-foreground/20 py-3 text-center text-[11px] text-muted-foreground">
                    Solte aqui
                  </p>
                )}

                <NovaTarefa time={time} usuarios={usuarios} onCriar={criar} />
              </div>
            </section>
          )
        })}
      </div>

      {/* Tarefas antigas, criadas antes dos times existirem. A faixa
          some sozinha quando a última for classificada. */}
      {(porTime.semTime.length > 0 || arrastando) && (
        <section
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setColunaAlvo("SEM_TIME")
          }}
          onDragLeave={() =>
            setColunaAlvo((c) => (c === "SEM_TIME" ? null : c))
          }
          onDrop={(e) => soltar(e, null)}
          className={cn(
            "rounded-2xl bg-muted/40 p-3 shadow-card transition-shadow",
            colunaAlvo === "SEM_TIME" && "shadow-md ring-2 ring-foreground/30"
          )}
        >
          <h3 className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            {porTime.semTime.length > 0
              ? `Sem time — ${porTime.semTime.length} a classificar`
              : "Sem time — solte aqui para tirar do time"}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {porTime.semTime.map((t) => (
              <CartaoTarefa
                key={t.id}
                tarefa={t}
                usuarios={usuarios}
                arrastando={arrastando === t.id}
                onArrastarInicio={() => setArrastando(t.id)}
                onArrastarFim={() => setArrastando(null)}
                onTrocarTime={(s) => patch(t.id, { setor: s })}
                onTrocarResponsavel={(r) => patch(t.id, { responsavelId: r })}
                onConcluir={() => patch(t.id, { status: "CONCLUIDA" })}
                    onAbrir={() => setAberta(t)}
              />
            ))}
          </div>
        </section>
      )}

      <PainelTarefa
        tarefaId={aberta?.id ?? null}
        titulo={aberta?.titulo ?? ""}
        ehDuvida={aberta?.tipo === "DUVIDA"}
        aberto={aberta !== null}
        onFechar={() => setAberta(null)}
        onMudou={recarregar}
      />
    </div>
  )
}
