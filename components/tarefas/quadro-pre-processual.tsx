"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import {
  AlarmClock,
  AlertTriangle,
  CalendarClock,
  Check,
  Flame,
  ListChecks,
  Loader2,
  Search,
  UserRound,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Segmentado } from "@/components/ui/segmentado"
import { Skeleton } from "@/components/ui/skeleton"
import { PainelTarefa } from "./painel-tarefa"
import { CORES_TIME, paletaDe } from "./cores-time"
import { cn } from "@/lib/utils"
import { ALERTA, DESTAQUE, etiquetaDePrioridade } from "@/components/ui/alerta"
import {
  COR_DA_ESFERA,
  ESFERA_PRE_LABEL,
  esferaPreProcessual,
  etapaDaPasta,
  rotuloDaCor,
  tarefaCombina,
  termosDaBusca,
  trechoDaBusca,
  type EsferaPre,
} from "@/lib/domain/tarefa"

/**
 * As tarefas pré-processuais de uma esfera.
 *
 * A pergunta da tela é "o que cada um tem parado antes do protocolo?".
 * Por isso a visão de abertura agrupa por responsável; a outra agrupa
 * por etapa (a coluna que veio do TickTick), para quem quer ver o
 * gargalo em vez da pessoa.
 *
 * A tela inteira usa a cor da esfera — amarelo no administrativo,
 * vermelho no judicial —, a mesma dos times, para que o cartão diga de
 * onde é mesmo fora daqui.
 */

type Tarefa = {
  id: string
  titulo: string
  data: string
  hora: string | null
  status: string
  prioridade: string
  setor: string | null
  pasta?: string | null
  tipo?: string | null
  descricao?: string | null
  responsavel: { id: string; name: string } | null
}

type Visao = "RESPONSAVEL" | "ETAPA"

const SEM_RESPONSAVEL = "Sem responsável"

function hojeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatarData(iso?: string | null) {
  if (!iso) return null
  return iso.slice(0, 10).split("-").reverse().join("/")
}

function Contador({
  icone: Icone,
  valor,
  rotulo,
  destaque,
}: {
  icone: LucideIcon
  valor: number
  rotulo: string
  destaque?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 shadow-card">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          destaque && valor > 0 ? ALERTA.selo : "bg-muted text-foreground/70"
        )}
      >
        <Icone size={16} />
      </span>
      <span className="min-w-0">
        <span className="font-heading block text-lg leading-none font-semibold tabular-nums">
          {valor}
        </span>
        <span className="block truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {rotulo}
        </span>
      </span>
    </div>
  )
}

function Cartao({
  tarefa,
  esfera,
  visao,
  hoje,
  concluindo,
  trecho,
  onConcluir,
  onAbrir,
}: {
  tarefa: Tarefa
  esfera: EsferaPre
  visao: Visao
  hoje: string
  concluindo: boolean
  trecho?: string | null
  onConcluir: () => void
  onAbrir: () => void
}) {
  const cor = CORES_TIME[COR_DA_ESFERA[esfera]]
  const time = paletaDe(tarefa.setor)
  const atrasada = tarefa.data.slice(0, 10) < hoje

  return (
    <li className={cn("rounded-xl border-l-4 p-3 shadow-card", cor.cartao, cor.borda)}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onAbrir}
          className="min-w-0 flex-1 rounded text-left text-[13px] leading-snug font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {tarefa.titulo}
        </button>
        <button
          type="button"
          onClick={onConcluir}
          disabled={concluindo}
          title="Marcar como concluída"
          aria-label={`Concluir ${tarefa.titulo}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-emerald-100 hover:text-emerald-700 disabled:opacity-50 dark:hover:bg-emerald-950 dark:hover:text-emerald-300"
        >
          {concluindo ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />}
        </button>
      </div>

      {trecho ? (
        <p className={cn("mt-1 rounded-md px-1.5 py-1 text-[11px] leading-snug", DESTAQUE.busca)}>
          <span className="line-clamp-2">{trecho}</span>
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
            atrasada ? ALERTA.atrasada : "bg-card/80 text-muted-foreground"
          )}
          title={atrasada ? "Atrasada" : undefined}
        >
          {atrasada ? <AlarmClock size={11} /> : <CalendarClock size={11} />}
          {formatarData(tarefa.data)}
          {tarefa.hora ? ` ${tarefa.hora}` : ""}
        </span>

        {etiquetaDePrioridade(tarefa.prioridade) ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-bold tracking-wide uppercase",
              etiquetaDePrioridade(tarefa.prioridade)
            )}
          >
            {tarefa.prioridade}
          </span>
        ) : null}

        {/* Na visão por responsável o nome já está no alto da coluna; a
            etapa é o que falta. Na visão por etapa, o contrário. */}
        {visao === "RESPONSAVEL" ? (
          <span className="rounded-full bg-card/80 px-2 py-0.5 font-semibold text-muted-foreground">
            {etapaDaPasta(tarefa.pasta)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-0.5 font-semibold text-muted-foreground">
            <UserRound size={11} />
            {tarefa.responsavel?.name ?? SEM_RESPONSAVEL}
          </span>
        )}

        {time ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-0.5 font-semibold text-muted-foreground">
            <span className={cn("size-2 rounded-full", time.ponto)} />
            {rotuloDaCor(tarefa.setor)}
          </span>
        ) : null}
      </div>
    </li>
  )
}

export function QuadroPreProcessual({ esfera }: { esfera: EsferaPre }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [visao, setVisao] = useState<Visao>("RESPONSAVEL")
  const [busca, setBusca] = useState("")
  const [concluindo, setConcluindo] = useState<string | null>(null)
  const [aberta, setAberta] = useState<Tarefa | null>(null)
  const [hoje] = useState(hojeLocal)
  const buscaAdiada = useDeferredValue(busca)

  const carregar = useCallback(() => {
    return fetch("/api/tarefas?abertas=1")
      .then((r) => (r.ok ? r.json() : { tarefas: [] }))
      .then((d) => setTarefas(d.tarefas ?? []))
      .catch((err) => console.error("Erro ao carregar o pré-processual:", err))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const daEsfera = useMemo(
    () =>
      tarefas.filter(
        (t) =>
          t.status !== "CONCLUIDA" &&
          t.status !== "CANCELADA" &&
          esferaPreProcessual(t) === esfera
      ),
    [tarefas, esfera]
  )

  const termos = termosDaBusca(buscaAdiada)
  const encontradas = useMemo(
    () => daEsfera.filter((t) => tarefaCombina(t, termosDaBusca(buscaAdiada))),
    [daEsfera, buscaAdiada]
  )

  const grupos = useMemo(() => {
    const mapa = new Map<string, Tarefa[]>()
    for (const t of encontradas) {
      const chave =
        visao === "RESPONSAVEL"
          ? (t.responsavel?.name ?? SEM_RESPONSAVEL)
          : etapaDaPasta(t.pasta)
      mapa.set(chave, [...(mapa.get(chave) ?? []), t])
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) =>
        `${a.data.slice(0, 10)} ${a.hora ?? ""}`.localeCompare(`${b.data.slice(0, 10)} ${b.hora ?? ""}`)
      )
    }
    // Quem tem mais fica primeiro; "sem responsável" sempre no fim,
    // porque é a fila que ninguém está olhando.
    return [...mapa.entries()].sort(([a, la], [b, lb]) => {
      if (a === SEM_RESPONSAVEL) return 1
      if (b === SEM_RESPONSAVEL) return -1
      return lb.length - la.length || a.localeCompare(b, "pt-BR")
    })
  }, [encontradas, visao])

  const resumo = useMemo(
    () => ({
      total: daEsfera.length,
      atrasadas: daEsfera.filter((t) => t.data.slice(0, 10) < hoje).length,
      urgentes: daEsfera.filter((t) => t.prioridade === "URGENTE").length,
      semResponsavel: daEsfera.filter((t) => !t.responsavel).length,
    }),
    [daEsfera, hoje]
  )

  /** As etapas que entraram — para conferir se a regra pegou o que devia. */
  const etapas = useMemo(() => {
    const conta = new Map<string, number>()
    for (const t of daEsfera) {
      const e = etapaDaPasta(t.pasta)
      conta.set(e, (conta.get(e) ?? 0) + 1)
    }
    return [...conta.entries()].sort((a, b) => b[1] - a[1])
  }, [daEsfera])

  async function concluir(t: Tarefa) {
    setConcluindo(t.id)
    try {
      const r = await fetch(`/api/tarefas/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONCLUIDA" }),
      })
      if (r.ok) setTarefas((atuais) => atuais.filter((x) => x.id !== t.id))
    } finally {
      setConcluindo(null)
    }
  }

  const cor = CORES_TIME[COR_DA_ESFERA[esfera]]

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4", cor.cabecalho)}>
          <h2 className="font-heading text-[18px] leading-tight font-bold tracking-[0.06em] uppercase">
            Pré-processual · {ESFERA_PRE_LABEL[esfera]}
          </h2>
          <p className="text-[12.5px] opacity-85">
            Tudo o que ainda não foi protocolado — a fase de que o resto depende.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
          <Contador icone={ListChecks} valor={resumo.total} rotulo="Nesta fase" />
          <Contador icone={AlertTriangle} valor={resumo.atrasadas} rotulo="Atrasadas" destaque />
          <Contador icone={Flame} valor={resumo.urgentes} rotulo="Urgentes" destaque />
          <Contador icone={UserX} valor={resumo.semResponsavel} rotulo="Sem responsável" destaque />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setBusca("")
            }}
            placeholder="Buscar: nome, CPF, final do telefone…"
            aria-label="Buscar tarefas pré-processuais"
            className="h-10 bg-card pr-9 pl-9 text-[13.5px] shadow-card [&::-webkit-search-cancel-button]:hidden"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <Segmentado
          valor={visao}
          onChange={setVisao}
          aria-label="Agrupar por"
          opcoes={[
            { valor: "RESPONSAVEL", rotulo: "Por responsável" },
            { valor: "ETAPA", rotulo: "Por etapa" },
          ]}
        />
      </div>

      {carregando ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : daEsfera.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-10 text-center text-[13.5px] text-muted-foreground shadow-card">
          Nenhuma tarefa {ESFERA_PRE_LABEL[esfera].toLowerCase()} em fase pré-processual agora.
        </p>
      ) : grupos.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-10 text-center text-[13.5px] text-muted-foreground shadow-card">
          Nada encontrado com essa busca.
        </p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {grupos.map(([nome, lista]) => (
            <section key={nome} className="overflow-hidden rounded-2xl bg-card shadow-card">
              <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className={cn("size-2.5 shrink-0 rounded-full", cor.ponto)} />
                <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-bold" title={nome}>
                  {nome}
                </h3>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-bold tabular-nums">
                  {lista.length}
                </span>
              </header>
              <ul className="flex max-h-[560px] flex-col gap-2 overflow-y-auto p-3">
                {lista.map((t) => (
                  <Cartao
                    key={t.id}
                    tarefa={t}
                    esfera={esfera}
                    visao={visao}
                    hoje={hoje}
                    concluindo={concluindo === t.id}
                    trecho={termos.length > 0 ? trechoDaBusca(t, termos) : null}
                    onConcluir={() => concluir(t)}
                    onAbrir={() => setAberta(t)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!carregando && etapas.length > 0 ? (
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Etapas que entram aqui:{" "}
          {etapas.map(([e, n], i) => (
            <span key={e}>
              {i > 0 ? " · " : ""}
              <strong className="font-semibold text-foreground/80">{e}</strong> ({n})
            </span>
          ))}
        </p>
      ) : null}

      <PainelTarefa
        tarefaId={aberta?.id ?? null}
        titulo={aberta?.titulo ?? ""}
        descricao={aberta?.descricao ?? null}
        pasta={aberta?.pasta ?? null}
        ehDuvida={aberta?.tipo === "DUVIDA"}
        aberto={aberta !== null}
        onFechar={() => setAberta(null)}
        onMudou={carregar}
      />
    </div>
  )
}
