"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { Check, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PainelTarefa } from "./painel-tarefa"
import { CORES_TIME } from "./cores-time"
import { CartaoTarefa, NovaTarefa, Pasta, agruparPorPasta, formatarData, type Tarefa, type Usuario } from "./cartao-tarefa"
import { concluirMinhaParte } from "./usar-tarefas"
import { cn } from "@/lib/utils"
import {
  TIMES_TAREFA,
  TIME_LABEL,
  TIME_LABEL_CURTO,
  isTimeTarefa,
  tarefaCombina,
  termosDaBusca,
  trechoDaBusca,
  type TimeTarefa,
} from "@/lib/domain/tarefa"

/**
 * Quadro de tarefas por time.
 *
 * A pergunta que ele responde é "de quem é isso?", e a resposta chega
 * pela cor antes de qualquer leitura. São quatro times — vermelho,
 * azul, amarelo e rosa, nesta ordem —, cada um num bloco separado, dois
 * por linha. O cartão da tarefa leva a cor do time dele: solto na tela,
 * ele continua dizendo de onde é. Dentro do cartão, o responsável vem
 * primeiro e em negrito: quem varre o quadro procura um nome.
 *
 * O campo continua se chamando `setor` no banco e na API; na tela, o
 * nome é time — ver lib/domain/tarefa/time.ts.
 */


export function QuadroTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null)
  const [aberta, setAberta] = useState<Tarefa | null>(null)

  // Busca: a de cima vale para o quadro inteiro; a lupa de cada time,
  // só para a coluna dele. As duas somam.
  const [busca, setBusca] = useState("")
  const [buscaDoTime, setBuscaDoTime] = useState<Partial<Record<TimeTarefa, string>>>({})
  const [comConcluidas, setComConcluidas] = useState(false)
  const [concluidas, setConcluidas] = useState<Tarefa[] | null>(null)
  const campoBusca = useRef<HTMLInputElement>(null)
  const buscaAdiada = useDeferredValue(busca)
  const termos = termosDaBusca(buscaAdiada)
  const buscaDoTimeAdiada = useDeferredValue(buscaDoTime)

  // "/" leva à busca de qualquer lugar do quadro, como no Gmail.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (e.key !== "/" || alvo.closest("input, textarea, select, [contenteditable]")) return
      e.preventDefault()
      campoBusca.current?.focus()
    }
    document.addEventListener("keydown", aoTeclar)
    return () => document.removeEventListener("keydown", aoTeclar)
  }, [])

  /**
   * As concluídas não vêm com o quadro — são milhares. Só descem quando
   * alguém pede para buscar nelas, e uma vez só.
   */
  const ligarConcluidas = useCallback(
    (ligar: boolean) => {
      setComConcluidas(ligar)
      if (!ligar || concluidas) return
      fetch("/api/tarefas")
        .then((r) => (r.ok ? r.json() : { tarefas: [] }))
        .then((d) =>
          setConcluidas(
            ((d.tarefas ?? []) as Tarefa[]).filter(
              (t) => t.status === "CONCLUIDA" || t.status === "CANCELADA"
            )
          )
        )
        .catch((err) => console.error("Erro ao carregar concluídas:", err))
    },
    [concluidas]
  )

  useEffect(() => {
    const lista = fetch("/api/tarefas?abertas=1")
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
    fetch("/api/tarefas?abertas=1")
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

      // Recusado (o rosa sem migration, por exemplo): a tela volta ao
      // que o banco tem, em vez de mostrar a tarefa onde ela não está.
      if (!r.ok) {
        recarregar()
        return
      }
      const { tarefa } = await r.json()

      setTarefas((atuais) =>
        atuais.map((t) => (t.id === id ? { ...t, ...tarefa } : t))
      )
    },
    [recarregar]
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
   * Concluir aqui fecha só a parte de quem clicou: a tarefa com outros
   * responsáveis no fluxo continua aberta para eles. A lista volta do
   * servidor para mostrar como ficou.
   */
  const concluir = useCallback(
    async (id: string) => {
      setTarefas((atuais) => atuais.filter((t) => t.id !== id))
      const r = await concluirMinhaParte(id)
      if (!r.ok) window.alert(r.erro)
      recarregar()
    },
    [recarregar]
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

  const encontradas = useMemo(
    () => emAberto.filter((t) => tarefaCombina(t, termosDaBusca(buscaAdiada))),
    [emAberto, buscaAdiada]
  )

  const concluidasEncontradas = useMemo(
    () =>
      comConcluidas && concluidas && termosDaBusca(buscaAdiada).length > 0
        ? concluidas.filter((t) => tarefaCombina(t, termosDaBusca(buscaAdiada)))
        : [],
    [comConcluidas, concluidas, buscaAdiada]
  )

  const porTime = useMemo(() => {
    const mapa = Object.fromEntries(
      TIMES_TAREFA.map((s) => [s, [] as Tarefa[]])
    ) as Record<TimeTarefa, Tarefa[]>
    const semTime: Tarefa[] = []

    for (const t of encontradas) {
      if (isTimeTarefa(t.setor)) {
        if (tarefaCombina(t, termosDaBusca(buscaDoTimeAdiada[t.setor] ?? ""))) mapa[t.setor].push(t)
      } else semTime.push(t)
    }

    for (const s of TIMES_TAREFA) {
      mapa[s].sort((a, b) => a.data.localeCompare(b.data))
    }

    return { mapa, semTime }
  }, [encontradas, buscaDoTimeAdiada])

  if (carregando) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    )
  }

  const buscando = termos.length > 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative w-full max-w-lg">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={campoBusca}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setBusca("")
            }}
            placeholder="Buscar em todas as pastas: nome, CPF, NB, processo…  ( / )"
            aria-label="Buscar tarefas"
            className="h-10 bg-card pr-9 pl-9 text-[13px] shadow-card [&::-webkit-search-cancel-button]:hidden"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => {
                setBusca("")
                campoBusca.current?.focus()
              }}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={comConcluidas}
            onChange={(e) => ligarConcluidas(e.target.checked)}
            className="size-4 accent-primary"
          />
          Buscar também nas concluídas
        </label>

        {buscando ? (
          <p className="text-[13px] text-muted-foreground" aria-live="polite">
            <strong className="text-foreground">{encontradas.length}</strong> em aberto
            {comConcluidas
              ? concluidas
                ? ` · ${concluidasEncontradas.length} concluídas`
                : " · carregando concluídas…"
              : ""}
          </p>
        ) : null}
      </div>

      {/* Quatro times, dois por linha, na ordem vermelho, azul, amarelo
          e rosa. Cada um é um bloco à parte: a cor chapada no alto
          separa um do outro sem precisar de rótulo com nome. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {TIMES_TAREFA.map((time) => {
          const cor = CORES_TIME[time]
          const lista = porTime.mapa[time]

          const alvo = colunaAlvo === time

          return (
            <section
              key={time}
              aria-label={`Time ${TIME_LABEL[time]}`}
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
                "flex flex-col overflow-visible rounded-2xl bg-card shadow-card transition-shadow",
                // Enquanto se arrasta, o bloco sob o cursor levanta a
                // mão: sem isso, soltar vira aposta.
                alvo && "shadow-md ring-2 ring-foreground/30"
              )}
            >
              <header
                className={cn(
                  "flex items-center gap-2 rounded-t-2xl px-4 py-3",
                  cor.cabecalho
                )}
              >
                <h3 className="font-heading flex-1 truncate text-[15px] leading-tight font-bold tracking-[0.08em] uppercase">
                  {TIME_LABEL[time]}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setBuscaDoTime((b) => {
                      const proximo = { ...b }
                      if (proximo[time] === undefined) proximo[time] = ""
                      else delete proximo[time]
                      return proximo
                    })
                  }
                  title={`Buscar só no ${TIME_LABEL[time]}`}
                  aria-label={`Buscar só no ${TIME_LABEL[time]}`}
                  aria-pressed={buscaDoTime[time] !== undefined}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md opacity-80 transition hover:bg-black/10 hover:opacity-100",
                    buscaDoTime[time] !== undefined && "bg-black/15 opacity-100"
                  )}
                >
                  <Search size={14} />
                </button>
                <span className="rounded-full bg-black/15 px-2.5 py-0.5 text-xs font-bold tabular-nums">
                  {lista.length}
                </span>
              </header>

              {buscaDoTime[time] !== undefined ? (
                <div className="relative px-3 pt-3">
                  <Search
                    size={13}
                    className="pointer-events-none absolute top-1/2 left-5.5 translate-y-[calc(-50%+6px)] text-muted-foreground"
                  />
                  <Input
                    autoFocus
                    value={buscaDoTime[time]}
                    onChange={(e) =>
                      setBuscaDoTime((b) => ({ ...b, [time]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Escape")
                        setBuscaDoTime((b) => {
                          const proximo = { ...b }
                          delete proximo[time]
                          return proximo
                        })
                    }}
                    placeholder={`Buscar no ${TIME_LABEL_CURTO[time]}…`}
                    aria-label={`Buscar no ${TIME_LABEL[time]}`}
                    className="h-8 bg-card pl-7 text-[13px]"
                  />
                </div>
              ) : null}

              <div className="flex min-h-[96px] flex-col gap-2 p-3">
                {(() => {
                  const termosDaColuna = [
                    ...termos,
                    ...termosDaBusca(buscaDoTimeAdiada[time] ?? ""),
                  ]
                  const filtrando = termosDaColuna.length > 0
                  const cartao = (t: Tarefa) => (
                    <CartaoTarefa
                      key={t.id}
                      tarefa={t}
                      usuarios={usuarios}
                      arrastando={arrastando === t.id}
                      onArrastarInicio={() => setArrastando(t.id)}
                      onArrastarFim={() => setArrastando(null)}
                      onTrocarTime={(s) => patch(t.id, { setor: s })}
                      onTrocarResponsavel={(r) => patch(t.id, { responsavelId: r })}
                      onConcluir={() => concluir(t.id)}
                      onAbrir={() => setAberta(t)}
                      trecho={filtrando ? trechoDaBusca(t, termosDaColuna) : null}
                    />
                  )
                  const { soltas, pastas } = agruparPorPasta(lista)
                  if (filtrando && lista.length === 0) {
                    return (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        Nada encontrado aqui.
                      </p>
                    )
                  }
                  return (
                    <>
                      {soltas.length > 0 ? (
                        <div className="grid gap-2 xl:grid-cols-2">{soltas.map(cartao)}</div>
                      ) : null}
                      {pastas.length > 0 ? (
                        <div className="grid items-start gap-2 xl:grid-cols-2">
                          {pastas.map(([nome, itens]) => (
                            <Pasta key={nome} nome={nome} quantas={itens.length} aberta={filtrando}>
                              {itens.map(cartao)}
                            </Pasta>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )
                })()}

                {lista.length === 0 && !arrastando && !buscando ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    Nenhuma tarefa em aberto.
                  </p>
                ) : null}

                {lista.length === 0 && arrastando && (
                  <p className="rounded-lg border border-dashed border-foreground/20 py-3 text-center text-xs text-muted-foreground">
                    Solte aqui
                  </p>
                )}

                <NovaTarefa time={time} usuarios={usuarios} onCriar={criar} />
              </div>
            </section>
          )
        })}
      </div>

      {/* Tarefas sem time, ou ainda gravadas numa cor que deixou de ser
          time (preto, verde). A faixa some sozinha quando a última for
          arrastada para um dos quatro. */}
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
          <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {porTime.semTime.length > 0
              ? `Fora dos quatro times — ${porTime.semTime.length} a classificar`
              : "Sem time — solte aqui para tirar do time"}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
                onConcluir={() => concluir(t.id)}
                onAbrir={() => setAberta(t)}
                trecho={buscando ? trechoDaBusca(t, termos) : null}
              />
            ))}
          </div>
        </section>
      )}

      {buscando && comConcluidas && concluidasEncontradas.length > 0 ? (
        <section className="rounded-2xl bg-muted/40 p-3 shadow-card">
          <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Concluídas que batem com a busca — {concluidasEncontradas.length}
          </h3>
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {concluidasEncontradas.slice(0, 60).map((t) => {
              const trecho = trechoDaBusca(t, termos)
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setAberta(t)}
                    className="flex w-full flex-col gap-0.5 rounded-xl bg-card px-3 py-2 text-left shadow-card transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-medium">
                      <Check size={12} className="shrink-0 text-emerald-600" />
                      <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatarData(t.data)}
                      {isTimeTarefa(t.setor) ? ` · ${TIME_LABEL_CURTO[t.setor]}` : ""}
                      {t.pasta ? ` · ${t.pasta}` : ""}
                    </span>
                    {trecho ? (
                      <span className="line-clamp-1 text-xs text-violet-800 dark:text-violet-300">
                        {trecho}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
          {concluidasEncontradas.length > 60 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Mostrando 60 de {concluidasEncontradas.length}. Acrescente uma palavra à
              busca para chegar mais perto.
            </p>
          ) : null}
        </section>
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
