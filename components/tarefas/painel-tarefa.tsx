"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowUpLeft,
  CircleHelp,
  Loader2,
  MessageSquareQuote,
  Send,
  SignpostBig,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  EVENTO_VERBO,
  type EventoTarefa,
  type TipoEventoTarefa,
} from "@/lib/domain/tarefa"

/**
 * A tarefa aberta, com o histórico ao lado.
 *
 * Duas abas e não uma tela só: o que está em aberto e o que já
 * aconteceu são leituras diferentes. Quem abre a tarefa para trabalhar
 * quer a pergunta pendente no alto; quem abre para entender por que o
 * caso demorou quer a linha do tempo, e cada uma atrapalha a outra
 * quando dividem o mesmo espaço.
 *
 * O histórico de uma tarefa comum inclui os eventos das dúvidas que
 * saíram dela. É o que faz o clone ficar integrado à principal: a
 * pergunta não some num cartão à parte do quadro.
 */

type Duvida = {
  id: string
  titulo: string
  status: string
  resposta: string | null
  respondidaEm: string | null
  criadoEm: string
  responsavel: { id: string; name: string } | null
}

type Historico = {
  eventos: EventoTarefa[]
  duvidas: Duvida[]
  tarefaPai: { id: string; titulo: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
}

const ICONE_EVENTO: Record<TipoEventoTarefa, typeof CircleHelp> = {
  DUVIDA_ABERTA: CircleHelp,
  DUVIDA_RESPONDIDA: MessageSquareQuote,
  STATUS_ALTERADO: SignpostBig,
}

const TOM_EVENTO: Record<TipoEventoTarefa, string> = {
  DUVIDA_ABERTA:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900",
  DUVIDA_RESPONDIDA:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900",
  STATUS_ALTERADO:
    "bg-muted text-muted-foreground ring-foreground/10",
}

function quando(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`
}

function Aba({
  ativa,
  onClick,
  children,
  contagem,
}: {
  ativa: boolean
  onClick: () => void
  children: React.ReactNode
  contagem?: number
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        ativa
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      {contagem !== undefined && contagem > 0 ? (
        <span className="rounded-full bg-muted px-1.5 text-[10.5px] font-bold tabular-nums">
          {contagem}
        </span>
      ) : null}
    </button>
  )
}

/** Abrir uma dúvida: uma linha de texto e pronto. */
function AbrirDuvida({
  onAbrir,
}: {
  onAbrir: (pergunta: string) => Promise<void>
}) {
  const [pergunta, setPergunta] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar() {
    setEnviando(true)
    setErro(null)
    try {
      await onAbrir(pergunta)
      setPergunta("")
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="rounded-lg bg-muted/50 p-3 shadow-card">
      <p className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Tirar uma dúvida
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
        Vira uma tarefa própria, ligada a esta — entra no quadro com
        responsável e prazo, e volta para cá quando for respondida.
      </p>
      <textarea
        value={pergunta}
        onChange={(e) => setPergunta(e.target.value)}
        rows={2}
        placeholder="O que precisa ser decidido antes de seguir?"
        className="mt-2 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button
          size="sm"
          onClick={enviar}
          disabled={pergunta.trim().length < 5 || enviando}
        >
          {enviando ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <CircleHelp size={13} className="mr-1" />
          )}
          Abrir dúvida
        </Button>
        {erro ? <span className="text-xs text-destructive">{erro}</span> : null}
      </div>
    </div>
  )
}

/** Responder fecha a dúvida — por isso o aviso antes do botão. */
function Responder({
  onResponder,
}: {
  onResponder: (resposta: string) => Promise<void>
}) {
  const [resposta, setResposta] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar() {
    setEnviando(true)
    setErro(null)
    try {
      await onResponder(resposta)
      setResposta("")
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível responder")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="rounded-lg bg-muted/50 p-3 shadow-card">
      <p className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Responder
      </p>
      <textarea
        value={resposta}
        onChange={(e) => setResposta(e.target.value)}
        rows={3}
        autoFocus
        placeholder="A resposta fica junto da pergunta, para quem reabrir o caso depois."
        className="mt-1.5 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={enviar} disabled={!resposta.trim() || enviando}>
          {enviando ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Send size={13} className="mr-1" />
          )}
          Responder e concluir
        </Button>
        <span className="text-[11.5px] text-muted-foreground">
          Responder conclui a dúvida e tira o cartão do quadro.
        </span>
        {erro ? <span className="text-xs text-destructive">{erro}</span> : null}
      </div>
    </div>
  )
}

function LinhaDoTempo({ eventos }: { eventos: EventoTarefa[] }) {
  if (eventos.length === 0) {
    return (
      <p className="py-8 text-center text-[12.5px] text-muted-foreground">
        Nada aconteceu com esta tarefa ainda.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {eventos.map((e) => {
        const Icone = ICONE_EVENTO[e.tipo]
        return (
          <li key={e.id} className="flex gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-1",
                TOM_EVENTO[e.tipo]
              )}
            >
              <Icone size={13} strokeWidth={2} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] leading-snug">
                <span className="font-semibold">
                  {e.autor?.name ?? "Alguém que saiu do escritório"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {EVENTO_VERBO[e.tipo]}
                </span>
                {e.tipo === "STATUS_ALTERADO" ? (
                  <span className="text-muted-foreground">
                    {" "}
                    de{" "}
                    <span className="font-medium text-foreground">
                      {STATUS_LABEL[e.statusDe ?? ""] ?? e.statusDe ?? "—"}
                    </span>{" "}
                    para{" "}
                    <span className="font-medium text-foreground">
                      {STATUS_LABEL[e.statusPara ?? ""] ?? e.statusPara ?? "—"}
                    </span>
                  </span>
                ) : null}
                <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">
                  {quando(e.criadoEm)}
                </span>
              </p>

              {e.texto ? (
                <p className="mt-1 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[12.5px] leading-relaxed whitespace-pre-wrap">
                  {e.texto}
                </p>
              ) : null}

              {/* Evento que aconteceu numa dúvida filha diz isso: fingir
                  que aconteceu aqui confundiria quem lê a linha do tempo. */}
              {e.daDuvida ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  nesta dúvida: {e.daDuvida.titulo}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * O conteúdo, montado por tarefa.
 *
 * Fica separado e com `key={tarefaId}` de propósito: assim abrir outra
 * tarefa remonta em vez de reaproveitar o estado da anterior. A versão
 * anterior zerava aba e dados dentro de um efeito, o que é setState
 * síncrono em efeito — cascata de render, e a regra do projeto barra.
 * Montar do zero faz o mesmo trabalho sem efeito nenhum.
 */
function ConteudoPainel({
  tarefaId,
  ehDuvida,
  onMudou,
}: {
  tarefaId: string
  ehDuvida: boolean
  onMudou: () => void
}) {
  const [aba, setAba] = useState<"tarefa" | "historico">("tarefa")
  const [dados, setDados] = useState<Historico | null>(null)
  // Nasce carregando: o fetch dispara na montagem, e começar em `false`
  // exigiria um setState síncrono no efeito só para dizer a verdade.
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/tarefas/${tarefaId}/historico`)
      setDados(r.ok ? await r.json() : null)
    } finally {
      setCarregando(false)
    }
  }, [tarefaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function abrirDuvida(pergunta: string) {
    const r = await fetch(`/api/tarefas/${tarefaId}/duvidas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta }),
    })
    if (!r.ok) throw new Error((await r.json()).error ?? "Falhou")
    await carregar()
    onMudou()
  }

  async function responder(resposta: string) {
    const r = await fetch(`/api/tarefas/${tarefaId}/resposta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resposta }),
    })
    if (!r.ok) throw new Error((await r.json()).error ?? "Falhou")
    await carregar()
    onMudou()
  }

  const emAberto = (dados?.duvidas ?? []).filter((d) => !d.resposta)
  const respondida = dados?.eventos.some(
    (e) => e.tipo === "DUVIDA_RESPONDIDA" && e.tarefaId === tarefaId
  )

  return (
    <>
      {dados?.tarefaPai ? (
        <DialogDescription className="flex items-center gap-1">
          <ArrowUpLeft size={13} className="shrink-0" />
          saiu de: {dados.tarefaPai.titulo}
        </DialogDescription>
      ) : null}

      <div role="tablist" className="flex border-b border-border">
        <Aba ativa={aba === "tarefa"} onClick={() => setAba("tarefa")}>
          {ehDuvida ? "A dúvida" : "Dúvidas"}
        </Aba>
        <Aba
          ativa={aba === "historico"}
          onClick={() => setAba("historico")}
          contagem={dados?.eventos.length}
        >
          Histórico
        </Aba>
      </div>

      {carregando && !dados ? (
        <p className="py-8 text-center text-muted-foreground">
          <Loader2 size={15} className="mx-auto animate-spin" />
        </p>
      ) : aba === "historico" ? (
        <LinhaDoTempo eventos={dados?.eventos ?? []} />
      ) : ehDuvida ? (
        respondida ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-[12.5px] text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
            Respondida. A resposta está no histórico.
          </p>
        ) : (
          <Responder onResponder={responder} />
        )
      ) : (
        <div className="flex flex-col gap-3">
          {emAberto.length > 0 ? (
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Esperando resposta
              </p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {emAberto.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] leading-snug ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900"
                  >
                    <p className="font-medium">{d.titulo}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      com {d.responsavel?.name ?? "ninguém"} · desde{" "}
                      {quando(d.criadoEm)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <AbrirDuvida onAbrir={abrirDuvida} />
        </div>
      )}
    </>
  )
}

export function PainelTarefa({
  tarefaId,
  titulo,
  ehDuvida,
  aberto,
  onFechar,
  onMudou,
}: {
  tarefaId: string | null
  titulo: string
  ehDuvida: boolean
  aberto: boolean
  onFechar: () => void
  /** A lista do quadro precisa saber que algo entrou ou saiu. */
  onMudou: () => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {ehDuvida ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-amber-800 uppercase dark:bg-amber-950/70 dark:text-amber-300">
                <CircleHelp size={11} />
                dúvida
              </span>
            ) : null}
            <span className="min-w-0">{titulo}</span>
          </DialogTitle>
        </DialogHeader>

        {aberto && tarefaId ? (
          <ConteudoPainel
            key={tarefaId}
            tarefaId={tarefaId}
            ehDuvida={ehDuvida}
            onMudou={onMudou}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
