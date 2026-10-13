"use client"

import { useEffect, useRef, useState } from "react"
import { AlarmClock, CalendarClock, Check, ChevronRight, CircleHelp, Folder, Loader2, Plus, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CORES_TIME, paletaDe } from "./cores-time"
import { cn } from "@/lib/utils"
import { ALERTA, DESTAQUE, etiquetaDePrioridade } from "@/components/ui/alerta"
import { TIMES_TAREFA, TIME_LABEL, rotuloDaCor, type TimeTarefa } from "@/lib/domain/tarefa"

/**
 * O cartão da tarefa e as peças em volta dele — pasta, nova tarefa,
 * menu suspenso —, num arquivo só para que o quadro geral e as telas
 * de cada time mostrem a tarefa do mesmo jeito.
 */

export type Responsavel = { id: string; name: string }

export type Tarefa = {
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
  descricao?: string | null
  pasta?: string | null
}

export type Usuario = { id: string; name: string; role: string }


export function iniciais(nome: string) {
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
export function nomeCurto(nome: string) {
  if (nome.length <= 14) return nome

  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 1) return partes[0]

  return `${partes[0]} ${partes[partes.length - 1][0]}.`
}

export function formatarData(iso?: string | null) {
  if (!iso) return null
  return iso.slice(0, 10).split("-").reverse().join("/")
}

export function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Menu genérico ancorado a um gatilho, usado para time e responsável. */
export function MenuSuspenso({
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

export function CartaoTarefa({
  tarefa,
  usuarios,
  arrastando,
  onArrastarInicio,
  onArrastarFim,
  onTrocarTime,
  onTrocarResponsavel,
  onConcluir,
  onAbrir,
  trecho,
  rodape,
  acaoExtra,
  arrastavel = true,
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
  /** Onde a busca bateu, quando não foi no título. */
  trecho?: string | null
  /** Embaixo do cartão: os próximos passos do fluxo, na tela do time. */
  rodape?: React.ReactNode
  /** Na linha de baixo do cartão, antes do concluir (o "Mover"). */
  acaoExtra?: React.ReactNode
  /** Nas telas de etapa não há onde soltar: o cartão não se arrasta. */
  arrastavel?: boolean
}) {
  const prazo = formatarData(tarefa.data)
  const atrasada = tarefa.data.slice(0, 10) < hojeISO()
  const responsavel = tarefa.responsavel
  const paleta = paletaDe(tarefa.setor)

  return (
    <div
      draggable={arrastavel}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", tarefa.id)
        e.dataTransfer.effectAllowed = "move"
        onArrastarInicio()
      }}
      onDragEnd={onArrastarFim}
      className={cn(
        "relative rounded-xl p-3 shadow-card transition-[opacity,box-shadow,transform] hover:shadow-float has-[[aria-expanded=true]]:z-30",
        // A cor do time vai no cartão: fundo claro e faixa à esquerda.
        paleta ? cn("border-l-4", paleta.cartao, paleta.borda) : "bg-card",
        arrastavel && "cursor-grab active:cursor-grabbing",
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
                className={cn("mt-0.5 shrink-0", DESTAQUE.duvidaIcone)}
              />
            ) : null}
            <span className="min-w-0 flex-1">{tarefa.titulo}</span>
          </button>
          {trecho ? (
            <p className={cn("mt-1 rounded-md px-1.5 py-1 text-[11px] leading-snug", DESTAQUE.busca)}>
              <span className="line-clamp-2">{trecho}</span>
            </p>
          ) : null}
        </div>

      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {prazo ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              atrasada && tarefa.status !== "CONCLUIDA"
                ? ALERTA.atrasada
                : "bg-card/80 text-muted-foreground"
            )}
            title={atrasada && tarefa.status !== "CONCLUIDA" ? "Atrasada" : undefined}
          >
            {atrasada && tarefa.status !== "CONCLUIDA" ? <AlarmClock size={11} /> : <CalendarClock size={11} />}
            {prazo}
            {tarefa.hora ? ` ${tarefa.hora}` : ""}
          </span>
        ) : null}

        {etiquetaDePrioridade(tarefa.prioridade) ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wide uppercase",
              etiquetaDePrioridade(tarefa.prioridade)
            )}
          >
            {tarefa.prioridade}
          </span>
        ) : null}

        {/* O time já está na cor do cartão: aqui fica só a bolinha que
            abre a troca de time, sem repetir o nome da cor. */}
        <MenuSuspenso titulo={`Trocar time (agora: ${rotuloDaCor(tarefa.setor) ?? "sem time"})`} gatilho={() => (
          // A bolinha é pequena; a área de toque em volta dela, não.
          <span className="flex size-7 items-center justify-center">
            <span
              className={cn(
                "size-3.5 rounded-full ring-2 ring-card",
                paleta ? paleta.ponto : "bg-muted-foreground/30"
              )}
            />
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
                  <span className={cn("size-2.5 rounded-full", CORES_TIME[s].ponto)} />
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

        {acaoExtra ? <div className="ml-auto">{acaoExtra}</div> : null}

        {/* Concluir mora no rodapé para o nome do responsável ficar
            com a largura inteira do cartão lá em cima. */}
        <button
          type="button"
          onClick={onConcluir}
          title="Marcar como concluída"
          aria-label={`Concluir tarefa ${tarefa.titulo}`}
          className={cn(acaoExtra ? "" : "ml-auto", "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground sm:size-6 transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-300")}
        >
          <Check size={14} strokeWidth={2.5} />
        </button>
      </div>

      {rodape}
    </div>
  )
}

/**
 * As pastas de um time — as listas que vieram do TickTick.
 *
 * Fechadas por padrão: um time com 150 tarefas em aberto vira uma
 * coluna que ninguém rola até o fim. Fechadas, a coluna mostra primeiro
 * o índice ("JUDICIAL › ANDAMENTO · 49") e cada um abre a sua. Tarefa
 * sem pasta — a criada aqui — fica solta no alto, que é onde se espera
 * ver o que acabou de nascer.
 */
export function agruparPorPasta(lista: Tarefa[]) {
  const soltas: Tarefa[] = []
  const pastas = new Map<string, Tarefa[]>()

  for (const t of lista) {
    if (!t.pasta) soltas.push(t)
    else pastas.set(t.pasta, [...(pastas.get(t.pasta) ?? []), t])
  }

  return {
    soltas,
    pastas: [...pastas.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")),
  }
}

export function Pasta({
  nome,
  quantas,
  aberta,
  children,
}: {
  nome: string
  quantas: number
  /** Durante a busca, pasta com resultado se abre sozinha. */
  aberta: boolean
  children: React.ReactNode
}) {
  return (
    <details open={aberta} className="group rounded-xl bg-card/55 shadow-card open:bg-card/30">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold outline-none select-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={13}
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
        <Folder size={13} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate" title={nome}>
          {nome}
        </span>
        <span className="rounded-full bg-muted px-1.5 text-[10.5px] font-bold text-muted-foreground tabular-nums">
          {quantas}
        </span>
      </summary>
      <div className="flex flex-col gap-2 px-1.5 pb-1.5">{children}</div>
    </details>
  )
}

export type DadosNovaTarefa = {
  titulo: string
  setor: TimeTarefa
  responsavelId: string | null
  data: string
  /** A etapa do fluxo, quando a tarefa nasce dentro de uma. */
  pasta?: string | null
}

export function NovaTarefa({
  time,
  pasta,
  usuarios,
  onCriar,
}: {
  time: TimeTarefa
  pasta?: string | null
  usuarios: Usuario[]
  onCriar: (dados: DadosNovaTarefa) => Promise<void>
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
        ...(pasta ? { pasta } : {}),
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

