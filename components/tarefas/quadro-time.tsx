"use client"

import Link from "next/link"
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, ArrowRightLeft, ChevronRight, Info, Loader2, Search, Undo2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useUsuario } from "@/components/layout/usuario-context"
import { ALERTA } from "@/components/ui/alerta"
import { cn } from "@/lib/utils"
import {
  ESFERAS_AMARELO,
  ESFERA_AMARELO_LABEL,
  ETAPAS,
  ETAPAS_DO_TIME,
  TIMES_TAREFA,
  TIME_LABEL,
  destinoNoFluxo,
  enderecoDaEtapa,
  etapaDaTarefa,
  etapasDaEsfera,
  isTimeTarefa,
  tarefaCombina,
  termosDaBusca,
  trechoDaBusca,
  type EsferaAmarelo,
  type EtapaId,
  type TimeTarefa,
} from "@/lib/domain/tarefa"
import { CORES_TIME } from "./cores-time"
import {
  CartaoTarefa,
  MenuSuspenso,
  NovaTarefa,
  Pasta,
  agruparPorPasta,
  type DadosNovaTarefa,
} from "./cartao-tarefa"
import { PainelTarefa } from "./painel-tarefa"
import { contar, useTarefasDoTime, type TarefaDoTime } from "./usar-tarefas"

/**
 * A tela de um time, desenhada como o quadro do Lucid: uma coluna por
 * etapa, na ordem em que o caso anda, cada uma com o cabeçalho na cor
 * do time. Embaixo de cada cartão ficam os próximos passos do fluxo
 * ("Caso bom → Agendar vídeo"): um clique e a tarefa vai para a etapa
 * seguinte — inclusive de outro time —, sem arrastar nem procurar.
 *
 * Serve três recortes, todos com a mesma lógica:
 *  - o time inteiro (/times/azul);
 *  - um lado do amarelo (/times/amarelo/judicial);
 *  - uma etapa só (/times/azul/agendar-video), com a regra da etapa
 *    por extenso no alto.
 */

/** "Agendar vídeo"; no amarelo, "Judicial › Protocolo". */
export function nomeDaEtapa(id: EtapaId) {
  const e = ETAPAS[id]
  return e.esfera ? `${ESFERA_AMARELO_LABEL[e.esfera]} › ${e.nome}` : e.nome
}

/** "Azul › Agendar vídeo" — para avisos que cruzam de um time a outro. */
function caminhoDaEtapa(id: EtapaId) {
  return `${TIME_LABEL[ETAPAS[id].time]} › ${nomeDaEtapa(id)}`
}

type Aviso = { texto: string; desfazer?: () => void }

// ── Próximos passos do cartão ─────────────────────────────

/**
 * O nome do destino visto de onde a tarefa está: dentro do mesmo lado
 * do amarelo basta "Protocolo"; em outro time, o caminho inteiro — a
 * bolinha ao lado diz a cor.
 */
function rotuloDoDestino(de: EtapaId | null, para: EtapaId) {
  const a = de ? ETAPAS[de] : null
  const b = ETAPAS[para]
  if (a && a.time === b.time && a.esfera === b.esfera) return b.nome
  return nomeDaEtapa(para)
}

/** Os caminhos que o desenho dá para sair desta etapa, um por linha. */
function SaidasDoFluxo({
  tarefa,
  etapa,
  onMover,
}: {
  tarefa: TarefaDoTime
  etapa: EtapaId | null
  onMover: (t: TarefaDoTime, para: EtapaId) => void
}) {
  const saidas = etapa ? ETAPAS[etapa].saidas : []
  if (!saidas.length) return null

  return (
    <div className="mt-2.5 grid gap-1.5 border-t border-foreground/10 pt-2.5">
      {saidas.map((s) => {
        const destino = ETAPAS[s.para]
        return (
          <button
            key={s.para + s.quando}
            type="button"
            onClick={() => onMover(tarefa, s.para)}
            title={`${s.quando}: mover para ${caminhoDaEtapa(s.para)}`}
            className="flex min-h-9 w-full items-center gap-2 rounded-lg bg-card px-3 py-1.5 text-left text-[12.5px] leading-tight shadow-card ring-1 ring-foreground/5 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.quando}</span>
            <ArrowRight size={12} aria-hidden className="shrink-0 text-muted-foreground" />
            <span className={cn("size-2 shrink-0 rounded-full", CORES_TIME[destino.time].ponto)} aria-hidden />
            <span className="shrink-0 font-semibold whitespace-nowrap">{rotuloDoDestino(etapa, s.para)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** "Mover": qualquer etapa de qualquer time, para o que o desenho não prevê. */
function MenuMover({
  tarefa,
  etapa,
  onMover,
}: {
  tarefa: TarefaDoTime
  etapa: EtapaId | null
  onMover: (t: TarefaDoTime, para: EtapaId) => void
}) {
  return (
    <MenuSuspenso
      titulo="Mover para outra etapa"
      gatilho={() => (
        <span className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground sm:h-7">
          <ArrowRightLeft size={13} aria-hidden />
          Mover
        </span>
      )}
    >
      {(fechar) => (
        <>
          {TIMES_TAREFA.filter((t) => ETAPAS_DO_TIME[t].length > 0).map((time) => (
            <div key={time} className="py-0.5">
              <p className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-[11.5px] font-bold text-muted-foreground">
                <span className={cn("size-2 rounded-full", CORES_TIME[time].ponto)} aria-hidden />
                {TIME_LABEL[time]}
              </p>
              {ETAPAS_DO_TIME[time].map((id) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  disabled={id === etapa && tarefa.setor === time}
                  onClick={() => {
                    onMover(tarefa, id)
                    fechar()
                  }}
                  className="flex w-full items-center rounded-md px-2.5 py-1.5 pl-6 text-left text-[13px] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-45"
                >
                  {nomeDaEtapa(id)}
                </button>
              ))}
            </div>
          ))}
        </>
      )}
    </MenuSuspenso>
  )
}

// ── Números do alto ───────────────────────────────────────

function Numeros({ lista, time }: { lista: TarefaDoTime[]; time: TimeTarefa }) {
  const n = contar(lista)
  const itens = [
    { rotulo: "Em aberto", valor: n.total, classe: "" },
    { rotulo: "Atrasadas", valor: n.atrasadas, classe: n.atrasadas ? ALERTA.atrasadaTexto : "" },
    { rotulo: "Urgentes", valor: n.urgentes, classe: n.urgentes ? ALERTA.atrasadaTexto : "" },
    { rotulo: "Sem responsável", valor: n.semResponsavel, classe: "" },
  ]
  return (
    <dl
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-2xl border-l-[6px] bg-card shadow-card sm:grid-cols-4",
        CORES_TIME[time].borda
      )}
    >
      {itens.map((i, idx) => (
        <div
          key={i.rotulo}
          className={cn(
            "flex flex-col gap-0.5 px-5 py-3.5",
            idx > 0 && "sm:border-l sm:border-border",
            idx % 2 === 1 && "border-l border-border",
            idx > 1 && "border-t border-border sm:border-t-0"
          )}
        >
          <dt className="text-[12.5px] text-muted-foreground">{i.rotulo}</dt>
          <dd className={cn("font-heading text-[26px] leading-none font-bold tabular-nums", i.classe)}>{i.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

// ── Faixa "fora do lugar" ─────────────────────────────────

type Movimento = { tarefa: TarefaDoTime; para: EtapaId }

function ForaDoLugar({
  movimentos,
  time,
  onMoverTodas,
}: {
  movimentos: Movimento[]
  time: TimeTarefa
  onMoverTodas: (m: Movimento[]) => Promise<void>
}) {
  const usuario = useUsuario()
  const [movendo, setMovendo] = useState(false)

  const chegam = movimentos.filter((m) => ETAPAS[m.para].time === time)
  const saem = movimentos.filter((m) => ETAPAS[m.para].time !== time)

  const grupos = useMemo(() => {
    const mapa = new Map<string, { para: EtapaId; de: string; pastas: Set<string>; qtd: number }>()
    for (const m of movimentos) {
      const de = isTimeTarefa(m.tarefa.setor) ? TIME_LABEL[m.tarefa.setor] : "sem time"
      const chave = `${m.para}|${de}`
      const g = mapa.get(chave) ?? { para: m.para, de, pastas: new Set<string>(), qtd: 0 }
      g.qtd++
      if (m.tarefa.pasta) g.pastas.add(m.tarefa.pasta)
      mapa.set(chave, g)
    }
    return [...mapa.values()].sort((a, b) => b.qtd - a.qtd)
  }, [movimentos])

  if (movimentos.length === 0) return null

  const admin = usuario?.role === "ADMIN"
  const tarefas = (n: number) => (n === 1 ? "1 tarefa" : `${n} tarefas`)
  const frase =
    chegam.length && saem.length
      ? `${tarefas(chegam.length)} de outros times e ${tarefas(saem.length)} daqui estão fora do lugar no fluxo novo.`
      : chegam.length
        ? `${tarefas(chegam.length)} ainda ${chegam.length === 1 ? "está" : "estão"} em outro time, mas no fluxo novo ${chegam.length === 1 ? "é" : "são"} daqui.`
        : `${tarefas(saem.length)} daqui ${saem.length === 1 ? "é" : "são"} de outro lugar no fluxo novo.`

  return (
    <section
      aria-label="Tarefas fora do lugar"
      className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-foreground/10 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground sm:flex">
          <ArrowRightLeft size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold">{frase}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Vieram assim do TickTick. Confira a lista e, se estiver certa, mova todas de uma vez.
          </p>
        </div>
        {admin ? (
          <Button
            onClick={async () => {
              setMovendo(true)
              try {
                await onMoverTodas(movimentos)
              } finally {
                setMovendo(false)
              }
            }}
            disabled={movendo}
            className="h-10 shrink-0 self-start"
          >
            {movendo ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
            Mover {movimentos.length === 1 ? "a tarefa" : `as ${movimentos.length}`}
          </Button>
        ) : (
          <p className="shrink-0 text-[12.5px] text-muted-foreground">Só o administrador move em lote.</p>
        )}
      </div>

      <details className="group mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-[13px] font-medium text-foreground/80 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <ChevronRight size={14} className="transition-transform group-open:rotate-90" aria-hidden />
          Ver para onde cada uma vai
        </summary>
        <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
          {grupos.map((g) => (
            <li key={g.para + g.de} className="rounded-xl bg-muted/50 px-3 py-2.5 text-[13px]">
              <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                <span className="tabular-nums">{g.qtd}</span>
                <span className="font-normal text-muted-foreground">do {g.de} para</span>
                <span className={cn("size-2 rounded-full", CORES_TIME[ETAPAS[g.para].time].ponto)} aria-hidden />
                {caminhoDaEtapa(g.para)}
              </p>
              {g.pastas.size ? (
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground" title={[...g.pastas].join(", ")}>
                  Hoje em {[...g.pastas].slice(0, 3).join(", ")}
                  {g.pastas.size > 3 ? ` e mais ${g.pastas.size - 3}` : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

// ── Coluna de uma etapa ───────────────────────────────────

function ColunaEtapa({
  etapa,
  lista,
  alvo,
  arrastando,
  onSobre,
  onSair,
  onSoltar,
  children,
  rodape,
}: {
  etapa: EtapaId
  lista: TarefaDoTime[]
  alvo: boolean
  arrastando: boolean
  onSobre: () => void
  onSair: () => void
  onSoltar: (e: React.DragEvent) => void
  children: React.ReactNode
  rodape: React.ReactNode
}) {
  const e = ETAPAS[etapa]
  const cor = CORES_TIME[e.time]

  return (
    <section
      aria-label={`Etapa ${nomeDaEtapa(etapa)}`}
      onDragOver={(ev) => {
        ev.preventDefault()
        ev.dataTransfer.dropEffect = "move"
        onSobre()
      }}
      onDragLeave={onSair}
      onDrop={onSoltar}
      className={cn(
        "flex min-w-0 flex-col rounded-2xl bg-muted/45 shadow-card transition-shadow",
        alvo && "shadow-md ring-2 ring-foreground/30"
      )}
    >
      <header className={cn("rounded-t-2xl px-4 pt-3 pb-2.5", cor.cabecalho)}>
        <div className="flex items-center gap-2">
          <Link
            href={enderecoDaEtapa(etapa)}
            className="font-heading min-w-0 flex-1 truncate rounded text-[16px] leading-tight font-extrabold tracking-[0.02em] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {e.nome}
          </Link>
          <span className="rounded-full bg-black/15 px-2.5 py-0.5 text-[12.5px] font-bold tabular-nums">
            {lista.length}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] opacity-85">{e.responsaveis}</p>
      </header>

      <div className="flex min-h-[120px] flex-col gap-2.5 p-3">
        {children}
        {lista.length === 0 ? (
          <p
            className={cn(
              "rounded-xl py-4 text-center text-[12.5px] text-muted-foreground",
              arrastando && "border border-dashed border-foreground/20"
            )}
          >
            {arrastando ? "Solte aqui" : "Nenhuma tarefa nesta etapa."}
          </p>
        ) : null}
        {rodape}
      </div>
    </section>
  )
}

// ── Regra da etapa (tela de uma etapa só) ─────────────────

function RegraDaEtapa({ etapa }: { etapa: EtapaId }) {
  const e = ETAPAS[etapa]
  const cor = CORES_TIME[e.time]
  return (
    <section aria-label="Como funciona esta etapa" className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div className={cn("flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3.5", cor.cabecalho)}>
        <h2 className="font-heading text-[19px] font-extrabold">{nomeDaEtapa(etapa)}</h2>
        <p className="text-[13px] opacity-90">Responsável no fluxo: {e.responsaveis}</p>
      </div>
      <div className="grid gap-5 px-5 py-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <Info size={14} aria-hidden />
            Como funciona
          </h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed marker:font-semibold marker:text-muted-foreground">
            {e.regras.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          {e.campo ? (
            <p className="mt-3 text-[13px] text-muted-foreground">
              O cartão precisa dizer: <span className="font-medium text-foreground">{e.campo}</span>
            </p>
          ) : null}
        </div>
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-muted-foreground">Daqui a tarefa vai para</h3>
          {e.saidas.length ? (
            <ul className="space-y-1.5">
              {e.saidas.map((s) => (
                <li key={s.para + s.quando}>
                  <Link
                    href={enderecoDaEtapa(s.para)}
                    className="flex items-center gap-2 rounded-xl bg-muted/55 px-3 py-2.5 text-[13.5px] outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="text-muted-foreground">{s.quando}</span>
                    <ArrowRight size={13} className="shrink-0 text-muted-foreground" aria-hidden />
                    <span className={cn("size-2.5 shrink-0 rounded-full", CORES_TIME[ETAPAS[s.para].time].ponto)} aria-hidden />
                    <span className="font-semibold">{caminhoDaEtapa(s.para)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">
              O desenho não define um próximo passo. Use “Mover” no cartão quando precisar.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

// ── O quadro ──────────────────────────────────────────────

export function QuadroTime({
  time,
  esfera = null,
  etapa = null,
}: {
  time: TimeTarefa
  /** Só no amarelo: mostrar um lado só. */
  esfera?: EsferaAmarelo | null
  /** Mostrar uma etapa só, com a regra por extenso. */
  etapa?: EtapaId | null
}) {
  const { tarefas, usuarios, carregando, erro, patch, criar, recarregar } = useTarefasDoTime()
  const [aberta, setAberta] = useState<TarefaDoTime | null>(null)
  const [busca, setBusca] = useState("")
  const buscaAdiada = useDeferredValue(busca)
  const termos = termosDaBusca(buscaAdiada)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const avisar = useCallback((a: Aviso | null) => {
    if (temporizador.current) clearTimeout(temporizador.current)
    setAviso(a)
    if (a) temporizador.current = setTimeout(() => setAviso(null), 7000)
  }, [])

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  /** As etapas que esta tela mostra, na ordem do desenho. */
  const etapasDaTela: EtapaId[] = useMemo(() => {
    if (etapa) return [etapa]
    if (esfera) return etapasDaEsfera(esfera)
    return ETAPAS_DO_TIME[time]
  }, [time, esfera, etapa])

  const emAberto = useMemo(
    () => tarefas.filter((t) => t.status !== "CONCLUIDA" && t.status !== "CANCELADA"),
    [tarefas]
  )

  // Cada tarefa do time e a etapa em que ela está.
  const doTime = useMemo(
    () =>
      emAberto
        .filter((t) => t.setor === time)
        .map((t) => ({ t, etapa: etapaDaTarefa(t) }))
        .sort((a, b) => a.t.data.localeCompare(b.t.data)),
    [emAberto, time]
  )

  const encontradas = useMemo(
    () => (termos.length ? doTime.filter(({ t }) => tarefaCombina(t, termos)) : doTime),
    [doTime, termos]
  )

  const porEtapa = useMemo(() => {
    const mapa = new Map<EtapaId, TarefaDoTime[]>(etapasDaTela.map((id) => [id, []]))
    for (const { t, etapa: e } of encontradas) if (e && mapa.has(e)) mapa.get(e)!.push(t)
    return mapa
  }, [encontradas, etapasDaTela])

  /** Do time, mas sem etapa reconhecida — só na tela do time inteiro. */
  const outras = useMemo(
    () => (esfera || etapa ? [] : encontradas.filter(({ etapa: e }) => !e).map(({ t }) => t)),
    [encontradas, esfera, etapa]
  )

  const naTela = useMemo(
    () => [...[...porEtapa.values()].flat(), ...outras],
    [porEtapa, outras]
  )

  /** O que o fluxo novo manda para cá ou tira daqui (vindo do TickTick). */
  const foraDoLugar: Movimento[] = useMemo(() => {
    if (etapa) return []
    const lista: Movimento[] = []
    for (const t of emAberto) {
      const para = destinoNoFluxo(t)
      if (!para) continue
      const chega = ETAPAS[para].time === time && (!esfera || ETAPAS[para].esfera === esfera)
      const sai = t.setor === time && !esfera
      if (chega || sai) lista.push({ tarefa: t, para })
    }
    return lista
  }, [emAberto, time, esfera, etapa])

  const mover = useCallback(
    async (t: TarefaDoTime, para: EtapaId) => {
      const destino = ETAPAS[para]
      const antes = { setor: t.setor, pasta: t.pasta ?? null }
      const ok = await patch(t.id, { setor: destino.time, pasta: destino.pasta })
      if (!ok) {
        avisar({ texto: "Não foi possível mover a tarefa. A tela voltou ao que está gravado." })
        return
      }
      const podeDesfazer = antes.setor === null || isTimeTarefa(antes.setor)
      avisar({
        texto: `${t.titulo} foi para ${caminhoDaEtapa(para)}.`,
        desfazer: podeDesfazer
          ? () => {
              patch(t.id, antes)
              avisar(null)
            }
          : undefined,
      })
    },
    [patch, avisar]
  )

  const moverTodas = useCallback(
    async (movimentos: Movimento[]) => {
      const r = await fetch("/api/tarefas/mover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movimentos: movimentos.map((m) => ({
            id: m.tarefa.id,
            setor: ETAPAS[m.para].time,
            pasta: ETAPAS[m.para].pasta,
          })),
        }),
      }).catch(() => null)
      const corpo = r ? await r.json().catch(() => ({})) : {}
      if (!r?.ok) {
        avisar({ texto: corpo.error ?? "Não foi possível mover as tarefas." })
        return
      }
      recarregar()
      avisar({ texto: `${corpo.movidas ?? movimentos.length} tarefas foram para o lugar do fluxo novo.` })
    },
    [avisar, recarregar]
  )

  const soltar = useCallback(
    (e: React.DragEvent, para: EtapaId) => {
      e.preventDefault()
      setAlvo(null)
      setArrastando(null)
      const id = e.dataTransfer.getData("text/plain")
      const t = tarefas.find((x) => x.id === id)
      if (t && etapaDaTarefa(t) !== para) mover(t, para)
    },
    [tarefas, mover]
  )

  const criarNaEtapa = useCallback(
    (dados: DadosNovaTarefa) => criar(dados as unknown as Record<string, unknown>),
    [criar]
  )

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (erro) {
    return <p className="rounded-2xl bg-card p-5 text-[14px] shadow-card">{erro}</p>
  }

  const cartao = (t: TarefaDoTime, etapaDoCartao: EtapaId | null, arrastavel: boolean) => (
    <CartaoTarefa
      key={t.id}
      tarefa={t}
      usuarios={usuarios}
      arrastavel={arrastavel}
      arrastando={arrastando === t.id}
      onArrastarInicio={() => setArrastando(t.id)}
      onArrastarFim={() => {
        setArrastando(null)
        setAlvo(null)
      }}
      onTrocarTime={(s) => patch(t.id, { setor: s })}
      onTrocarResponsavel={(r) => patch(t.id, { responsavelId: r })}
      onConcluir={() => patch(t.id, { status: "CONCLUIDA" })}
      onAbrir={() => setAberta(t)}
      trecho={termos.length ? trechoDaBusca(t, termos) : null}
      rodape={<SaidasDoFluxo tarefa={t} etapa={etapaDoCartao} onMover={mover} />}
      acaoExtra={<MenuMover tarefa={t} etapa={etapaDoCartao} onMover={mover} />}
    />
  )

  const coluna = (id: EtapaId) => {
    const lista = porEtapa.get(id) ?? []
    return (
      <ColunaEtapa
        key={id}
        etapa={id}
        lista={lista}
        alvo={alvo === id}
        arrastando={arrastando !== null}
        onSobre={() => setAlvo(id)}
        onSair={() => setAlvo((a) => (a === id ? null : a))}
        onSoltar={(e) => soltar(e, id)}
        rodape={<NovaTarefa time={time} pasta={ETAPAS[id].pasta} usuarios={usuarios} onCriar={criarNaEtapa} />}
      >
        {lista.map((t) => cartao(t, id, true))}
      </ColunaEtapa>
    )
  }

  const gradeDasColunas = (ids: EtapaId[]) => (
    <div
      className={cn(
        "grid items-start gap-4 md:grid-cols-2",
        ids.length === 3 && "xl:grid-cols-3",
        ids.length >= 4 && "2xl:grid-cols-4"
      )}
    >
      {ids.map(coluna)}
    </div>
  )

  const listaDaEtapa = etapa ? porEtapa.get(etapa) ?? [] : []

  return (
    <div className="space-y-5">
      {etapa ? <RegraDaEtapa etapa={etapa} /> : null}

      <Numeros lista={etapa ? listaDaEtapa : naTela} time={time} />

      <ForaDoLugar movimentos={foraDoLugar} time={time} onMoverTodas={moverTodas} />

      <div className="relative w-full max-w-xl">
        <Search
          size={17}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setBusca("")
          }}
          placeholder={`Buscar no ${TIME_LABEL[time].toLowerCase()}: nome, CPF, NB, processo…`}
          aria-label={`Buscar tarefas do time ${TIME_LABEL[time]}`}
          className="h-11 bg-card pr-10 pl-10 text-[14px] shadow-card [&::-webkit-search-cancel-button]:hidden"
        />
        {busca ? (
          <button
            type="button"
            onClick={() => setBusca("")}
            aria-label="Limpar busca"
            className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      {etapa ? (
        // Uma etapa só: os cartões em grade, com a largura toda.
        <section aria-label={`Tarefas em ${nomeDaEtapa(etapa)}`} className="space-y-3">
          <div className="max-w-sm">
            <NovaTarefa time={time} pasta={ETAPAS[etapa].pasta} usuarios={usuarios} onCriar={criarNaEtapa} />
          </div>
          {listaDaEtapa.length ? (
            <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {listaDaEtapa.map((t) => cartao(t, etapa, false))}
            </div>
          ) : (
            <p className="rounded-2xl bg-card px-5 py-8 text-center text-[14px] text-muted-foreground shadow-card">
              {termos.length ? "Nada encontrado nesta etapa." : "Nenhuma tarefa nesta etapa agora."}
            </p>
          )}
        </section>
      ) : time === "AMARELO" && !esfera ? (
        // O amarelo tem dois lados, um embaixo do outro, como no desenho.
        ESFERAS_AMARELO.map((lado) => (
          <section key={lado} aria-label={`Amarelo ${ESFERA_AMARELO_LABEL[lado]}`} className="space-y-3">
            <h2 className="flex items-center gap-2">
              <Link
                href={`/times/amarelo/${lado === "JUDICIAL" ? "judicial" : "administrativo"}`}
                className="font-heading rounded-lg text-[19px] font-extrabold tracking-[-0.01em] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                {ESFERA_AMARELO_LABEL[lado]}
              </Link>
            </h2>
            {gradeDasColunas(etapasDaEsfera(lado))}
          </section>
        ))
      ) : etapasDaTela.length ? (
        gradeDasColunas(etapasDaTela)
      ) : (
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <p className="text-[14.5px] font-semibold">O {TIME_LABEL[time].toLowerCase()} ainda não tem etapas no fluxo.</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Por enquanto as tarefas dele aparecem abaixo, pelas pastas que vieram do TickTick.
          </p>
          <div className="mt-3 max-w-sm">
            <NovaTarefa time={time} usuarios={usuarios} onCriar={criarNaEtapa} />
          </div>
        </div>
      )}

      {outras.length ? (
        <section aria-label="Outras tarefas do time" className="space-y-3">
          <div>
            <h2 className="font-heading text-[17px] font-bold">
              {etapasDaTela.length ? "Ainda sem etapa" : "Tarefas"}{" "}
              <span className="text-muted-foreground tabular-nums">· {outras.length}</span>
            </h2>
            {etapasDaTela.length ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Do {TIME_LABEL[time].toLowerCase()}, mas numa pasta que não é etapa do fluxo. Use “Mover” no cartão para pôr cada uma no lugar.
              </p>
            ) : null}
          </div>
          {(() => {
            const { soltas, pastas } = agruparPorPasta(outras)
            return (
              <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                {soltas.length ? (
                  <Pasta nome="Sem pasta" quantas={soltas.length} aberta={termos.length > 0}>
                    {soltas.map((t) => cartao(t, null, true))}
                  </Pasta>
                ) : null}
                {pastas.map(([nome, itens]) => (
                  <Pasta key={nome} nome={nome} quantas={itens.length} aberta={termos.length > 0}>
                    {itens.map((t) => cartao(t, null, true))}
                  </Pasta>
                ))}
              </div>
            )
          })()}
        </section>
      ) : null}

      {aviso ? (
        <div
          role="status"
          aria-live="polite"
          className="animate-in fade-in slide-in-from-bottom-2 fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-foreground px-4 py-3 text-[13.5px] text-background shadow-float duration-200 md:bottom-6"
        >
          <span className="min-w-0 flex-1">{aviso.texto}</span>
          {aviso.desfazer ? (
            <button
              type="button"
              onClick={aviso.desfazer}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-semibold underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-background/60 focus-visible:outline-none"
            >
              <Undo2 size={14} aria-hidden />
              Desfazer
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => avisar(null)}
            aria-label="Fechar aviso"
            className="flex size-7 shrink-0 items-center justify-center rounded-md opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      <PainelTarefa
        tarefaId={aberta?.id ?? null}
        titulo={aberta?.titulo ?? ""}
        descricao={aberta?.descricao ?? null}
        pasta={aberta?.pasta ?? null}
        ehDuvida={aberta?.tipo === "DUVIDA"}
        aberto={aberta !== null}
        onFechar={() => setAberta(null)}
        onMudou={recarregar}
      />
    </div>
  )
}
