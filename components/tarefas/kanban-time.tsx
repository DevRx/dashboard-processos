"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CircleHelp,
  Info,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Undo2,
  UserRound,
  X,
} from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { Flutuante } from "@/components/ui/flutuante"
import { ALERTA, DESTAQUE, etiquetaDePrioridade } from "@/components/ui/alerta"
import { useUsuario } from "@/components/layout/usuario-context"
import { cn } from "@/lib/utils"
import {
  ESFERAS_AMARELO,
  ESFERA_AMARELO_LABEL,
  ETAPAS,
  ETAPAS_DO_TIME,
  TIMES_TAREFA,
  TIME_LABEL,
  atribuicoesDa,
  etapaBastaUm,
  etapasDaEsfera,
  gruposDa,
  pessoasDaEtapa,
  tarefaCombina,
  termosDaBusca,
  trechoDaBusca,
  usuarioDaPessoa,
  type EsferaAmarelo,
  type EtapaId,
  type Grupo,
  type Saida,
  type TimeTarefa,
} from "@/lib/domain/tarefa"
import { CORES_TIME } from "./cores-time"
import { formatarData, iniciais, type Usuario } from "./cartao-tarefa"
import { PainelTarefa } from "./painel-tarefa"
import { hojeISO, useTarefasDoTime, type ResultadoAcao, type TarefaDoTime } from "./usar-tarefas"

/**
 * O time como um kanban, no jeito do TickTick: as etapas do fluxo em
 * colunas lado a lado, cada coluna rolando por dentro, cartões
 * compactos. Os filtros de etapa ficam no alto da própria tela (o menu
 * lateral só leva ao time).
 *
 * Um cartão é a tarefa num lugar do fluxo. A mesma tarefa pode estar em
 * dois lugares (ADM e Judicial) — aparece nos dois, com o aviso
 * "também em". Os responsáveis aparecem no pé do cartão: quem já fez a
 * sua parte fica com o visto, e o cartão só sai da coluna quando a
 * última parte for concluída.
 */

type Lugar = { setor: TimeTarefa; etapa: EtapaId | null }

/** Coluna do kanban: uma etapa, ou "sem etapa" do time. */
type Coluna = { chave: string; lugar: Lugar; titulo: string; rotulo?: string }

type Cartao = { tarefa: TarefaDoTime; grupo: Grupo; outros: Grupo[] }

export type FiltroInicial = { etapa?: EtapaId | null; lado?: EsferaAmarelo | null }

const lugarDaEtapa = (id: EtapaId): Lugar => ({ setor: ETAPAS[id].time, etapa: id })

/** "Agendar vídeo"; no amarelo, "Judicial › Protocolo". */
export function nomeDaEtapa(id: EtapaId) {
  const e = ETAPAS[id]
  return e.esfera ? `${ESFERA_AMARELO_LABEL[e.esfera]} › ${e.nome}` : e.nome
}

function nomeDoLugar(l: Lugar) {
  return l.etapa ? `${TIME_LABEL[l.setor]} › ${nomeDaEtapa(l.etapa)}` : `${TIME_LABEL[l.setor]} (sem etapa)`
}

/** O destino visto de onde se está: no mesmo lado do amarelo basta "Protocolo". */
function destinoCurto(de: EtapaId | null, para: EtapaId) {
  const a = de ? ETAPAS[de] : null
  const b = ETAPAS[para]
  return a && a.time === b.time && a.esfera === b.esfera ? b.nome : nomeDaEtapa(para)
}

/**
 * Um próximo passo no menu: o que aconteceu em cima, miúdo, e para onde
 * vai embaixo. Em linha, um "quando" comprido ("Benefício permanente
 * concedido") espremia o destino até virar reticências.
 */
function ConteudoSaida({ saida, de }: { saida: Saida; de: EtapaId | null }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-xs leading-snug text-muted-foreground">{saida.quando}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <ArrowRight size={12} className="shrink-0 text-muted-foreground" aria-hidden />
        <span className={cn("size-2 shrink-0 rounded-full", CORES_TIME[ETAPAS[saida.para].time].ponto)} aria-hidden />
        <span className="truncate font-semibold">{destinoCurto(de, saida.para)}</span>
      </span>
    </span>
  )
}

function primeiroNome(nome?: string | null) {
  return (nome ?? "").trim().split(/\s+/)[0] || "Sem nome"
}


/** Cartões montados por coluna antes do "mostrar mais" (teste de 15/10: o tempo até a tela aparecer cresce com os cartões). */
const JANELA_DA_COLUNA = 60

// ── Avatares dos responsáveis ─────────────────────────────

function Pessoas({ grupo, usuarios, eu }: { grupo: Grupo; usuarios: Usuario[]; eu?: string }) {
  const nome = (id: string | null) => usuarios.find((u) => u.id === id)?.name ?? null
  const abertas = grupo.abertas.filter((a) => a.responsavelId)
  const semNinguem = abertas.length === 0

  return (
    <div className="flex min-w-0 items-center gap-1">
      {semNinguem ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <UserRound size={13} aria-hidden />
          Sem responsável
        </span>
      ) : (
        <div className="flex gap-1">
          {abertas.map((a) => (
            <span
              key={a.id}
              title={`${nome(a.responsavelId) ?? "?"} — parte em aberto`}
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white",
                a.responsavelId === eu ? "bg-gradient-brand" : "bg-slate-500 dark:bg-slate-600"
              )}
            >
              {iniciais(nome(a.responsavelId) ?? "?")}
            </span>
          ))}
        </div>
      )}
      {grupo.feitas.map((a) => (
        <span
          key={a.id}
          title={`${nome(a.responsavelId) ?? "Alguém"} já concluiu a parte dele`}
          className="relative flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
        >
          {iniciais(nome(a.responsavelId) ?? "?")}
          <span className="absolute -right-0.5 -bottom-0.5 flex size-3 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-card">
            <Check size={8} strokeWidth={3.5} aria-hidden />
          </span>
        </span>
      ))}
      <span className="ml-1 truncate text-xs text-muted-foreground">
        {semNinguem
          ? ""
          : abertas.length === 1
            ? primeiroNome(nome(abertas[0].responsavelId))
            : `${abertas.length} responsáveis`}
      </span>
    </div>
  )
}

// ── Menus do cartão ───────────────────────────────────────

function ItemMenu({
  children,
  onClick,
  perigo,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  perigo?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-45",
        perigo && "text-orange-800 dark:text-orange-300"
      )}
    >
      {children}
    </button>
  )
}

function TituloMenu({ children, onVoltar }: { children: React.ReactNode; onVoltar?: () => void }) {
  return (
    <div className="flex items-center gap-1 px-2 pt-1 pb-1.5">
      {onVoltar ? (
        <button
          type="button"
          onClick={onVoltar}
          aria-label="Voltar"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <ArrowLeft size={14} />
        </button>
      ) : null}
      <p className="text-xs font-semibold text-muted-foreground">{children}</p>
    </div>
  )
}

/** Lista de etapas por time, para mover ou pôr também em outro lugar. */
function EscolherLugar({ atual, onEscolher }: { atual: Lugar; onEscolher: (l: Lugar) => void }) {
  return (
    <div className="pb-1">
      {TIMES_TAREFA.map((time) => (
        <div key={time} className="py-0.5">
          <p className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground">
            <span className={cn("size-2 rounded-full", CORES_TIME[time].ponto)} aria-hidden />
            {TIME_LABEL[time]}
          </p>
          {(ETAPAS_DO_TIME[time].length ? ETAPAS_DO_TIME[time] : [null]).map((id) => {
            const lugar: Lugar = { setor: time, etapa: id }
            const igual = lugar.setor === atual.setor && lugar.etapa === atual.etapa
            return (
              <ItemMenu key={id ?? `${time}-sem`} disabled={igual} onClick={() => onEscolher(lugar)}>
                <span className="pl-3.5">{id ? nomeDaEtapa(id) : "Sem etapa"}</span>
                {igual ? <span className="ml-auto text-xs text-muted-foreground">aqui</span> : null}
              </ItemMenu>
            )
          })}
        </div>
      ))}
    </div>
  )
}

type Visao = "principal" | "mover" | "adicionar" | "responsaveis"

function MenuDoCartao({
  cartao,
  usuarios,
  onMover,
  onAdicionar,
  onResponsaveis,
  onConcluirEtapa,
  onAbrir,
}: {
  cartao: Cartao
  usuarios: Usuario[]
  onMover: (para: Lugar, responsaveis?: string[] | null) => void
  onAdicionar: (para: Lugar) => void
  onResponsaveis: (ids: string[]) => void
  onConcluirEtapa: () => void
  onAbrir: () => void
}) {
  const botao = useRef<HTMLButtonElement>(null)
  const [aberto, setAberto] = useState(false)
  const [visao, setVisao] = useState<Visao>("principal")
  const { grupo } = cartao
  const atuais = grupo.abertas.map((a) => a.responsavelId).filter((x): x is string => Boolean(x))
  const [marcados, setMarcados] = useState<string[]>(atuais)
  const fechar = useCallback(() => {
    setAberto(false)
    setVisao("principal")
  }, [])
  const saidas = grupo.etapa ? ETAPAS[grupo.etapa].saidas : []

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => {
          setMarcados(atuais)
          setAberto((v) => !v)
        }}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Ações da tarefa ${cartao.tarefa.titulo}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 sm:size-7 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 sm:aria-expanded:opacity-100"
      >
        <MoreHorizontal size={16} />
      </button>

      <Flutuante ancora={botao} aberto={aberto} onFechar={fechar} rotulo="Ações da tarefa">
        {visao === "principal" ? (
          <>
            {saidas.length ? (
              <>
                <TituloMenu>Próximo passo</TituloMenu>
                {saidas.map((s) => (
                  <ItemMenu
                    key={s.para + s.quando}
                    onClick={() => {
                      onMover(lugarDaEtapa(s.para))
                      fechar()
                    }}
                  >
                    <ConteudoSaida saida={s} de={grupo.etapa} />
                  </ItemMenu>
                ))}
                <div className="my-1 h-px bg-border" />
              </>
            ) : null}
            <ItemMenu onClick={() => setVisao("mover")}>Mover para outra etapa…</ItemMenu>
            <ItemMenu onClick={() => setVisao("adicionar")}>Pôr também em outro lugar…</ItemMenu>
            <ItemMenu onClick={() => setVisao("responsaveis")}>Responsáveis desta etapa…</ItemMenu>
            <ItemMenu
              onClick={() => {
                onAbrir()
                fechar()
              }}
            >
              Abrir tarefa (dúvidas e histórico)
            </ItemMenu>
            {grupo.abertas.length > 1 ? (
              <>
                <div className="my-1 h-px bg-border" />
                <ItemMenu
                  perigo
                  onClick={() => {
                    onConcluirEtapa()
                    fechar()
                  }}
                >
                  Concluir a etapa para todos
                </ItemMenu>
              </>
            ) : null}
          </>
        ) : visao === "mover" || visao === "adicionar" ? (
          <>
            <TituloMenu onVoltar={() => setVisao("principal")}>
              {visao === "mover" ? "Mover para" : "Pôr também em"}
            </TituloMenu>
            <EscolherLugar
              atual={{ setor: grupo.setor, etapa: grupo.etapa }}
              onEscolher={(l) => {
                if (visao === "mover") onMover(l)
                else onAdicionar(l)
                fechar()
              }}
            />
          </>
        ) : (
          <>
            <TituloMenu onVoltar={() => setVisao("principal")}>Quem responde por esta etapa</TituloMenu>
            {usuarios.map((u) => {
              const marcado = marcados.includes(u.id)
              return (
                <label key={u.id} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() =>
                      setMarcados((m) => (marcado ? m.filter((x) => x !== u.id) : [...m, u.id]))
                    }
                    className="size-4 accent-primary"
                  />
                  <span className="truncate">{u.name}</span>
                </label>
              )
            })}
            <div className="flex justify-end gap-1.5 px-1.5 pt-2 pb-1">
              <button
                type="button"
                onClick={() => {
                  onResponsaveis(marcados)
                  fechar()
                }}
                className="h-8 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Salvar
              </button>
            </div>
          </>
        )}
      </Flutuante>
    </>
  )
}

/**
 * O círculo de concluir, como no TickTick. Conclui a parte de quem
 * clicou; se não é dele e há mais de um responsável, pergunta de quem.
 * Quando a parte concluída é a última da etapa e o desenho tem próximo
 * passo, pergunta para onde a tarefa vai — concluir de vez é escolha,
 * não acidente. Na etapa `bastaUm` (a entrega do rosa), quem conclui
 * encerra a etapa para todos os responsáveis.
 */
function Concluir({
  cartao,
  usuarios,
  eu,
  onConcluirParte,
  onConcluirEtapa,
  onMover,
}: {
  cartao: Cartao
  usuarios: Usuario[]
  eu?: string
  onConcluirParte: (responsavelId: string | null) => void
  onConcluirEtapa: () => void
  onMover: (para: Lugar) => void
}) {
  const botao = useRef<HTMLButtonElement>(null)
  const [pergunta, setPergunta] = useState<null | "quem" | "depois">(null)
  const [parte, setParte] = useState<string | null>(null)
  const { grupo } = cartao
  const minha = grupo.abertas.find((a) => a.responsavelId && a.responsavelId === eu)
  // Ao concluir, só as saídas do fluxo normal; as de "só no menu" ficam no "…".
  const saidas = grupo.etapa ? ETAPAS[grupo.etapa].saidas.filter((s) => !s.soNoMenu) : []
  const nome = (id: string | null) => usuarios.find((u) => u.id === id)?.name ?? "Sem responsável"
  const fechar = useCallback(() => setPergunta(null), [])
  // Etapa em que os responsáveis são alternativas (a entrega do rosa):
  // quem conclui encerra a etapa para todos, sem perguntar de quem.
  const bastaUm = etapaBastaUm(grupo.etapa)
  const encerrar = (responsavelId: string | null) =>
    bastaUm ? onConcluirEtapa() : onConcluirParte(responsavelId)

  const concluir = (responsavelId: string | null) => {
    const ultima = bastaUm || grupo.abertas.length === 1
    if (ultima && saidas.length) {
      setParte(responsavelId)
      setPergunta("depois")
      return
    }
    encerrar(responsavelId)
    setPergunta(null)
  }

  const rotulo = bastaUm
    ? grupo.abertas.length > 1
      ? "Concluir para todos"
      : "Concluir"
    : minha
      ? "Concluir a minha parte"
      : grupo.abertas.length === 1
        ? "Concluir"
        : "Concluir a parte de alguém"

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => {
          if (minha) concluir(minha.responsavelId)
          else if (bastaUm || grupo.abertas.length === 1) concluir(grupo.abertas[0].responsavelId)
          else setPergunta("quem")
        }}
        title={rotulo}
        aria-label={`${rotulo}: ${cartao.tarefa.titulo}`}
        className="group/check mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-muted-foreground/45 text-transparent transition-colors outline-none hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-ring/60 dark:hover:bg-emerald-950"
      >
        <Check size={12} strokeWidth={3} aria-hidden />
      </button>

      <Flutuante ancora={botao} aberto={pergunta !== null} onFechar={fechar} rotulo="Concluir" largura={288}>
        {pergunta === "quem" ? (
          <>
            <TituloMenu>Concluir a parte de quem?</TituloMenu>
            {grupo.abertas.map((a) => (
              <ItemMenu key={a.id} onClick={() => concluir(a.responsavelId)}>
                {nome(a.responsavelId)}
              </ItemMenu>
            ))}
            <div className="my-1 h-px bg-border" />
            <ItemMenu
              perigo
              onClick={() => {
                onConcluirEtapa()
                fechar()
              }}
            >
              De todos — a etapa acabou
            </ItemMenu>
          </>
        ) : (
          <>
            <TituloMenu>Terminou aqui. Para onde vai?</TituloMenu>
            {saidas.map((s) => (
              <ItemMenu
                key={s.para + s.quando}
                onClick={() => {
                  onMover(lugarDaEtapa(s.para))
                  fechar()
                }}
              >
                <ConteudoSaida saida={s} de={grupo.etapa} />
              </ItemMenu>
            ))}
            <div className="my-1 h-px bg-border" />
            <ItemMenu
              onClick={() => {
                encerrar(parte)
                fechar()
              }}
            >
              Só concluir{cartao.outros.length ? " esta etapa" : " a tarefa"}
            </ItemMenu>
          </>
        )}
      </Flutuante>
    </>
  )
}

// ── O cartão ──────────────────────────────────────────────

function CartaoKanban({
  cartao,
  usuarios,
  eu,
  termos,
  arrastando,
  onArrastar,
  onSoltarFim,
  agir,
  onAbrir,
}: {
  cartao: Cartao
  usuarios: Usuario[]
  eu?: string
  termos: string[]
  arrastando: boolean
  onArrastar: () => void
  onSoltarFim: () => void
  agir: (corpo: Record<string, unknown>, aviso: string, desfazer?: Record<string, unknown>) => void
  onAbrir: () => void
}) {
  const { tarefa, grupo, outros } = cartao
  const de: Lugar = { setor: grupo.setor, etapa: grupo.etapa }
  const atrasada = tarefa.data.slice(0, 10) < hojeISO()
  const prioridade = etiquetaDePrioridade(tarefa.prioridade)
  const trecho = termos.length ? trechoDaBusca(tarefa, termos) : null

  const mover = (para: Lugar, responsaveis?: string[] | null) =>
    agir(
      { acao: "mover", de, para, ...(responsaveis === undefined ? {} : { responsaveis }) },
      `${tarefa.titulo} foi para ${nomeDoLugar(para)}.`,
      { acao: "mover", de: para, para: de, responsaveis: grupo.abertas.map((a) => a.responsavelId).filter(Boolean) }
    )

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ id: tarefa.id, de }))
        e.dataTransfer.effectAllowed = "move"
        onArrastar()
      }}
      onDragEnd={onSoltarFim}
      className={cn(
        "group relative cursor-grab rounded-xl border-l-[3px] bg-card p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-foreground/[0.06] transition-[box-shadow,opacity] [contain-intrinsic-size:auto_92px] [content-visibility:auto] hover:shadow-card active:cursor-grabbing",
        CORES_TIME[grupo.setor].borda,
        arrastando && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        <Concluir
          cartao={cartao}
          usuarios={usuarios}
          eu={eu}
          onConcluirParte={(responsavelId) =>
            agir(
              { acao: "concluirParte", em: de, responsavelId },
              grupo.abertas.length > 1
                ? `Parte concluída. A tarefa segue com ${grupo.abertas.length - 1 === 1 ? "o outro responsável" : "os outros responsáveis"}.`
                : outros.length
                  ? `Etapa concluída. A tarefa segue em ${nomeDoLugar(outros[0])}.`
                  : `${tarefa.titulo} foi concluída.`
            )
          }
          onConcluirEtapa={() => agir({ acao: "concluirEtapa", em: de }, `Etapa concluída para todos os responsáveis.`)}
          onMover={(para) => mover(para)}
        />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onAbrir}
            className="w-full rounded text-left text-sm leading-snug font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {tarefa.tipo === "DUVIDA" ? (
              <CircleHelp size={13} strokeWidth={2.2} aria-label="dúvida" className={cn("mr-1 inline align-[-2px]", DESTAQUE.duvidaIcone)} />
            ) : null}
            <span className="line-clamp-3">{tarefa.titulo}</span>
          </button>

          {trecho ? (
            <p className={cn("mt-1 rounded-md px-1.5 py-1 text-xs leading-snug", DESTAQUE.busca)}>
              <span className="line-clamp-2">{trecho}</span>
            </p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold",
                atrasada ? ALERTA.atrasada : "text-muted-foreground"
              )}
            >
              {atrasada ? <AlarmClock size={11} aria-hidden /> : <CalendarClock size={11} aria-hidden />}
              {formatarData(tarefa.data)}
              {tarefa.hora ? ` ${tarefa.hora}` : ""}
            </span>
            {prioridade ? (
              <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase", prioridade)}>
                {tarefa.prioridade}
              </span>
            ) : null}
            {outros.map((o) => (
              <span
                key={o.chave}
                title={`Também em ${nomeDoLugar(o)}`}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", CORES_TIME[o.setor].ponto)} aria-hidden />
                <span className="truncate">também {o.etapa ? nomeDaEtapa(o.etapa) : TIME_LABEL[o.setor]}</span>
              </span>
            ))}
          </div>
        </div>

        <MenuDoCartao
          cartao={cartao}
          usuarios={usuarios}
          onMover={mover}
          onAdicionar={(para) => agir({ acao: "adicionar", para }, `${tarefa.titulo} agora também está em ${nomeDoLugar(para)}.`)}
          onResponsaveis={(ids) => agir({ acao: "responsaveis", em: de, responsaveis: ids }, "Responsáveis da etapa atualizados.")}
          onConcluirEtapa={() => agir({ acao: "concluirEtapa", em: de }, "Etapa concluída para todos os responsáveis.")}
          onAbrir={onAbrir}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 pl-[30px]">
        <Pessoas grupo={grupo} usuarios={usuarios} eu={eu} />
      </div>
    </article>
  )
}

// ── Nova tarefa numa coluna ───────────────────────────────

function NovaNaColuna({
  coluna,
  usuarios,
  onCriar,
  onFechar,
}: {
  coluna: Coluna
  usuarios: Usuario[]
  onCriar: (dados: Record<string, unknown>) => Promise<boolean>
  onFechar: () => void
}) {
  const [titulo, setTitulo] = useState("")
  const [data, setData] = useState(hojeISO())
  const [quem, setQuem] = useState("")
  const [salvando, setSalvando] = useState(false)
  const etapa = coluna.lugar.etapa
  const padrao = etapa
    ? pessoasDaEtapa(etapa)
        .map((p) => usuarioDaPessoa(p, usuarios)?.name)
        .filter(Boolean)
        .map((n) => primeiroNome(n))
    : []

  async function criar() {
    if (!titulo.trim()) return
    setSalvando(true)
    const ok = await onCriar({
      titulo: titulo.trim(),
      data,
      setor: coluna.lugar.setor,
      ...(etapa ? { etapa } : {}),
      ...(quem === "ninguem" ? { responsaveis: [] } : quem ? { responsaveis: [quem] } : {}),
    })
    setSalvando(false)
    if (ok) onFechar()
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-2.5 shadow-card ring-1 ring-primary/30">
      <input
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") criar()
          if (e.key === "Escape") onFechar()
        }}
        placeholder="Nome do cliente – final do celular"
        aria-label="Título da tarefa"
        className="h-9 rounded-lg bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground"
      />
      <div className="flex gap-1.5">
        <select
          value={quem}
          onChange={(e) => setQuem(e.target.value)}
          aria-label="Responsável"
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value="">{padrao.length ? `Padrão: ${padrao.join(" e ")}` : "Sem responsável"}</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
          {padrao.length ? <option value="ninguem">Sem responsável</option> : null}
        </select>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          aria-label="Data"
          className="h-8 shrink-0 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={criar}
          disabled={salvando || !titulo.trim()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {salvando ? <Loader2 size={13} className="animate-spin" /> : null}
          Criar
        </button>
        <button type="button" onClick={onFechar} className="h-8 rounded-lg px-3 text-[13px] text-muted-foreground hover:bg-accent">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Regra da etapa (o "i" da coluna) ──────────────────────

function RegraDaColuna({ coluna }: { coluna: Coluna }) {
  const botao = useRef<HTMLButtonElement>(null)
  const [aberto, setAberto] = useState(false)
  const fechar = useCallback(() => setAberto(false), [])
  const e = coluna.lugar.etapa ? ETAPAS[coluna.lugar.etapa] : null

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Como funciona: ${coluna.titulo}`}
        aria-expanded={aberto}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Info size={14} />
      </button>
      <Flutuante ancora={botao} aberto={aberto} onFechar={fechar} rotulo={`Como funciona: ${coluna.titulo}`} largura={320} className="p-3">
        {e ? (
          <div className="space-y-2.5 text-[13px] leading-relaxed">
            <p className="font-semibold">
              {nomeDaEtapa(e.id)} <span className="font-normal text-muted-foreground">· {e.responsaveis}</span>
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              {e.regras.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
            {e.campo ? <p className="text-muted-foreground">O cartão precisa dizer: {e.campo}.</p> : null}
            {e.saidas.length ? (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Daqui vai para</p>
                <ul className="space-y-0.5">
                  {e.saidas.map((s) => (
                    <li key={s.para + s.quando} className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{s.quando}</span>
                      <ArrowRight size={11} className="text-muted-foreground" aria-hidden />
                      <span className={cn("size-2 rounded-full", CORES_TIME[ETAPAS[s.para].time].ponto)} aria-hidden />
                      <span className="font-medium">{nomeDaEtapa(s.para)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] leading-relaxed">
            Tarefas do {TIME_LABEL[coluna.lugar.setor].toLowerCase()} que ainda não estão numa etapa do fluxo — em geral,
            listas do TickTick que o desenho não tem. Arraste para uma etapa ou use “Mover” no cartão.
          </p>
        )}
      </Flutuante>
    </>
  )
}

// ── O kanban ──────────────────────────────────────────────

export function KanbanTime({
  time,
  inicial,
  onFiltro,
}: {
  time: TimeTarefa
  inicial?: FiltroInicial
  /** Para a página manter o filtro no endereço (link que se pode mandar). */
  onFiltro?: (f: FiltroInicial) => void
}) {
  const usuario = useUsuario()
  const eu = usuario?.id
  const { tarefas, usuarios, carregando, erro, fluxoLigado, agir, criar, recarregar, patch } = useTarefasDoTime()

  const [etapa, setEtapa] = useState<EtapaId | null>(inicial?.etapa ?? null)
  const [lado, setLado] = useState<EsferaAmarelo | null>(inicial?.lado ?? (inicial?.etapa ? ETAPAS[inicial.etapa].esfera ?? null : null))
  const [soMinhas, setSoMinhas] = useState(false)
  const [busca, setBusca] = useState("")
  const termos = termosDaBusca(useDeferredValue(busca))
  const [aberta, setAberta] = useState<TarefaDoTime | null>(null)
  const [novaEm, setNovaEm] = useState<string | null>(null)
  // Janela por coluna: uma coluna com 400 cartões não é lida, é rolada.
  // A tela monta os primeiros e oferece "mostrar mais"; a busca e os
  // filtros continuam valendo sobre todos (o filtro é antes da janela).
  const [mostrando, setMostrando] = useState<Record<string, number>>({})
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; desfazer?: () => void; erro?: boolean } | null>(null)
  const [trazendo, setTrazendo] = useState(false)
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (relogio.current) clearTimeout(relogio.current)
  }, [])

  const avisar = useCallback((a: typeof aviso) => {
    if (relogio.current) clearTimeout(relogio.current)
    setAviso(a)
    if (a) relogio.current = setTimeout(() => setAviso(null), a.erro ? 9000 : 7000)
  }, [])

  const mudarFiltro = (f: FiltroInicial) => {
    if (f.etapa !== undefined) setEtapa(f.etapa)
    if (f.lado !== undefined) setLado(f.lado)
    onFiltro?.({ etapa: f.etapa !== undefined ? f.etapa : etapa, lado: f.lado !== undefined ? f.lado : lado })
  }

  /** Todos os cartões do time, já com o "também em". */
  const cartoes = useMemo(() => {
    const lista: Cartao[] = []
    for (const t of tarefas) {
      if (t.status === "CONCLUIDA" || t.status === "CANCELADA") continue
      const grupos = gruposDa(atribuicoesDa(t))
      for (const g of grupos) {
        if (g.setor !== time) continue
        lista.push({ tarefa: t, grupo: g, outros: grupos.filter((o) => o.chave !== g.chave) })
      }
    }
    return lista.sort((a, b) => a.tarefa.data.localeCompare(b.tarefa.data) || a.tarefa.titulo.localeCompare(b.tarefa.titulo))
  }, [tarefas, time])

  const filtrados = useMemo(
    () =>
      cartoes.filter(
        (c) =>
          (!soMinhas || c.grupo.abertas.some((a) => a.responsavelId === eu)) &&
          (!termos.length || tarefaCombina(c.tarefa, termos))
      ),
    [cartoes, soMinhas, eu, termos]
  )

  /** As colunas do time, na ordem do desenho, e a de "sem etapa" no fim. */
  const todasColunas: Coluna[] = useMemo(() => {
    const etapas = time === "AMARELO" ? ESFERAS_AMARELO.flatMap((e) => etapasDaEsfera(e)) : ETAPAS_DO_TIME[time]
    const cols: Coluna[] = etapas.map((id) => ({
      chave: id,
      lugar: { setor: time, etapa: id },
      titulo: ETAPAS[id].nome,
      rotulo: ETAPAS[id].esfera ? ESFERA_AMARELO_LABEL[ETAPAS[id].esfera!] : undefined,
    }))
    cols.push({ chave: "sem-etapa", lugar: { setor: time, etapa: null }, titulo: etapas.length ? "Sem etapa" : "Tarefas" })
    return cols
  }, [time])

  const porColuna = useMemo(() => {
    const mapa = new Map<string, Cartao[]>(todasColunas.map((c) => [c.chave, []]))
    for (const c of filtrados) mapa.get(c.grupo.etapa ?? "sem-etapa")?.push(c)
    return mapa
  }, [filtrados, todasColunas])

  const colunas = todasColunas.filter((c) => {
    if (c.chave === "sem-etapa") return !etapa && ((porColuna.get(c.chave)?.length ?? 0) > 0 || todasColunas.length === 1)
    const e = ETAPAS[c.lugar.etapa!]
    if (etapa) return etapa === c.lugar.etapa || (time === "AMARELO" && !lado && ETAPAS[etapa].nome === e.nome)
    if (lado) return e.esfera === lado
    return true
  })

  const atrasadas = filtrados.filter((c) => c.tarefa.data.slice(0, 10) < hojeISO()).length
  const virtuais = cartoes.filter((c) => c.grupo.abertas.some((a) => a.virtual)).length

  const fazer = useCallback(
    async (id: string, corpo: Record<string, unknown>, texto: string, desfazer?: Record<string, unknown>) => {
      const r: ResultadoAcao = await agir(id, corpo)
      if (!r.ok && r.status === 503) {
        // Sem a migration no banco: mover e concluir ainda funcionam do
        // jeito antigo (time + pasta, ou a tarefa inteira).
        const para = corpo.para as Lugar | undefined
        const antigo =
          corpo.acao === "mover" && para
            ? await patch(id, { setor: para.setor, pasta: para.etapa ? ETAPAS[para.etapa].pasta : null })
            : corpo.acao === "concluirParte" || corpo.acao === "concluirEtapa"
              ? await patch(id, { status: "CONCLUIDA" })
              : false
        avisar(antigo ? { texto } : { texto: r.erro, erro: true })
        return
      }
      if (!r.ok) {
        avisar({ texto: r.erro, erro: true })
        return
      }
      avisar({
        texto,
        desfazer: desfazer
          ? async () => {
              avisar(null)
              const v = await agir(id, desfazer)
              if (!v.ok) avisar({ texto: v.erro, erro: true })
            }
          : undefined,
      })
    },
    [agir, avisar, patch]
  )

  const soltar = (e: React.DragEvent, coluna: Coluna) => {
    e.preventDefault()
    setAlvo(null)
    setArrastando(null)
    try {
      const { id, de } = JSON.parse(e.dataTransfer.getData("text/plain")) as { id: string; de: Lugar }
      if (de.setor === coluna.lugar.setor && de.etapa === coluna.lugar.etapa) return
      const t = tarefas.find((x) => x.id === id)
      const para = coluna.lugar
      fazer(
        id,
        { acao: "mover", de, para, ...(para.etapa ? {} : { responsaveis: null }) },
        `${t?.titulo ?? "A tarefa"} foi para ${nomeDoLugar(para)}.`,
        { acao: "mover", de: para, para: de, responsaveis: null }
      )
    } catch {
      // arrasto que não veio de um cartão: ignora
    }
  }

  async function trazerTudo() {
    setTrazendo(true)
    const r = await fetch("/api/tarefas/fluxo", { method: "POST" }).catch(() => null)
    const json = r ? await r.json().catch(() => ({})) : {}
    setTrazendo(false)
    if (!r?.ok) {
      avisar({ texto: json.error ?? "Não foi possível gravar agora.", erro: true })
      return
    }
    recarregar()
    avisar({ texto: `${json.tarefas ?? 0} tarefas do TickTick passaram a seguir o fluxo novo.` })
  }

  if (carregando) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[420px] w-[288px] shrink-0" />
        ))}
      </div>
    )
  }
  if (erro) return <p className="rounded-2xl bg-card p-5 text-sm shadow-card">{erro}</p>

  const cor = CORES_TIME[time]
  const chips: { chave: string; rotulo: string; qtd: number; ativo: boolean; onClick: () => void }[] = [
    {
      chave: "todas",
      rotulo: "Todas as etapas",
      qtd: filtrados.filter((c) => !lado || !c.grupo.etapa || ETAPAS[c.grupo.etapa].esfera === lado).length,
      ativo: !etapa,
      onClick: () => mudarFiltro({ etapa: null }),
    },
    ...(time === "AMARELO"
      ? // Um chip por etapa do desenho (Pendente, Protocolo, Prioridade,
        // Andamentos): cada um reúne o lado administrativo e o judicial.
        [...new Set(etapasDaEsfera("ADMINISTRATIVO").map((id) => ETAPAS[id].slug))].map((slug) => {
          const ids = etapasDaEsfera("ADMINISTRATIVO").concat(etapasDaEsfera("JUDICIAL")).filter((id) => ETAPAS[id].slug === slug && (!lado || ETAPAS[id].esfera === lado))
          return {
            chave: slug,
            rotulo: ETAPAS[ids[0]].nome,
            qtd: ids.reduce((s, id) => s + (porColuna.get(id)?.length ?? 0), 0),
            ativo: Boolean(etapa && ETAPAS[etapa].slug === slug),
            onClick: () => mudarFiltro({ etapa: ids[0] }),
          }
        })
      : ETAPAS_DO_TIME[time].map((id) => ({
          chave: id,
          rotulo: ETAPAS[id].nome,
          qtd: porColuna.get(id)?.length ?? 0,
          ativo: etapa === id,
          onClick: () => mudarFiltro({ etapa: id }),
        }))),
  ]

  return (
    <div className="space-y-4">
      {!fluxoLigado ? (
        <p className="rounded-xl bg-card px-4 py-3 text-[13px] shadow-card ring-1 ring-orange-300/60 dark:ring-orange-800">
          <strong>O fluxo novo ainda não está ligado no banco.</strong> As tarefas aparecem pelas pastas do TickTick e
          mover funciona, mas mais de um responsável e estar em dois lugares só valem depois de rodar a migration
          <code className="mx-1 rounded bg-muted px-1">20261013200000_fluxo_atribuicoes.sql</code>no Supabase.
        </p>
      ) : virtuais > 0 && usuario?.role === "ADMIN" ? (
        <div className="flex flex-col gap-2 rounded-xl bg-card px-4 py-3 shadow-card sm:flex-row sm:items-center">
          <p className="flex-1 text-[13px]">
            <strong>{virtuais} {virtuais === 1 ? "tarefa ainda segue" : "tarefas ainda seguem"} a pasta do TickTick.</strong>{" "}
            <span className="text-muted-foreground">
              Elas já aparecem no lugar certo; gravar no fluxo faz o resto do sistema (agenda, dashboard) ver igual.
            </span>
          </p>
          <button
            type="button"
            onClick={trazerTudo}
            disabled={trazendo}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:self-auto"
          >
            {trazendo ? <Loader2 size={14} className="animate-spin" /> : null}
            Gravar todas no fluxo
          </button>
        </div>
      ) : null}

      {/* Filtros: as etapas viraram filtro dentro do time. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setBusca("")
              }}
              placeholder="Buscar: nome, CPF, NB…"
              aria-label={`Buscar no ${TIME_LABEL[time].toLowerCase()}`}
              className="h-10 w-full rounded-xl bg-card pr-9 pl-9 text-[13px] shadow-card ring-1 ring-foreground/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
            />
            {busca ? (
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {time === "AMARELO" ? (
            <div role="group" aria-label="Lado do amarelo" className="inline-flex rounded-xl bg-muted p-1">
              {([null, "ADMINISTRATIVO", "JUDICIAL"] as const).map((l) => (
                <button
                  key={l ?? "os-dois"}
                  type="button"
                  onClick={() => mudarFiltro({ lado: l, etapa: etapa && l && ETAPAS[etapa].esfera !== l ? null : etapa })}
                  aria-pressed={lado === l}
                  className={cn(
                    "h-8 rounded-lg px-3 text-[13px] font-medium transition-colors",
                    lado === l ? "bg-card font-semibold shadow-card" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l ? ESFERA_AMARELO_LABEL[l] : "Os dois"}
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setSoMinhas((v) => !v)}
            aria-pressed={soMinhas}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-medium ring-1 transition-colors",
              soMinhas ? "bg-foreground text-background ring-foreground" : "bg-card text-foreground ring-foreground/10 hover:bg-accent"
            )}
          >
            <UserRound size={14} aria-hidden />
            Só as minhas
          </button>

          {atrasadas ? (
            <span className={cn("inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold", ALERTA.atrasada)}>
              <AlarmClock size={13} aria-hidden />
              {atrasadas} {atrasadas === 1 ? "atrasada" : "atrasadas"}
            </span>
          ) : null}
        </div>

        {chips.length > 1 ? (
          <div role="group" aria-label="Filtrar por etapa" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {chips.map((c) => (
              <button
                key={c.chave}
                type="button"
                onClick={c.onClick}
                aria-pressed={c.ativo}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium ring-1 transition-colors",
                  c.ativo ? cn(cor.cabecalho, "ring-transparent") : "bg-card text-foreground ring-foreground/10 hover:bg-accent"
                )}
              >
                {c.rotulo}
                <span className={cn("rounded-full px-1.5 text-xs font-semibold tabular-nums", c.ativo ? "bg-black/15" : "bg-muted text-muted-foreground")}>
                  {c.qtd}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* O quadro: colunas lado a lado, rolando para o lado; cada coluna rola por dentro. */}
      <div className="-mx-4 overflow-x-auto pb-3 sm:-mx-5 md:-mx-7 [scrollbar-width:thin]" style={{ scrollSnapType: "x proximity" }}>
        <div className="flex min-w-max items-start gap-3 px-4 sm:px-5 md:px-7">
          {colunas.map((coluna) => {
            const lista = porColuna.get(coluna.chave) ?? []
            const ehAlvo = alvo === coluna.chave
            return (
              <section
                key={coluna.chave}
                aria-label={`Coluna ${coluna.rotulo ? `${coluna.rotulo} ` : ""}${coluna.titulo}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                  setAlvo(coluna.chave)
                }}
                onDragLeave={() => setAlvo((a) => (a === coluna.chave ? null : a))}
                onDrop={(e) => soltar(e, coluna)}
                style={{ scrollSnapAlign: "start" }}
                className={cn(
                  "flex max-h-[calc(100dvh-236px)] min-h-[200px] w-[84vw] max-w-[320px] shrink-0 flex-col rounded-2xl bg-muted/55 ring-1 ring-foreground/[0.04] transition-shadow sm:w-[300px] md:max-h-[calc(100dvh-200px)]",
                  ehAlvo && "ring-2 ring-foreground/30"
                )}
              >
                <header className="flex items-center gap-1.5 rounded-t-2xl px-3 pt-3 pb-2">
                  <span className={cn("h-4 w-1 shrink-0 rounded-full", cor.ponto)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    {coluna.rotulo ? (
                      <p className="text-xs leading-none font-semibold text-muted-foreground">{coluna.rotulo}</p>
                    ) : null}
                    <h3 title={coluna.titulo} className="truncate text-[15px] leading-tight font-bold">{coluna.titulo}</h3>
                  </div>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">{lista.length}</span>
                  <RegraDaColuna coluna={coluna} />
                  <button
                    type="button"
                    onClick={() => setNovaEm(coluna.chave)}
                    aria-label={`Nova tarefa em ${coluna.titulo}`}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Plus size={15} />
                  </button>
                </header>

                <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
                  {novaEm === coluna.chave ? (
                    <NovaNaColuna
                      coluna={coluna}
                      usuarios={usuarios}
                      onCriar={async (d) => {
                        const ok = await criar(d)
                        if (!ok) avisar({ texto: "Não foi possível criar a tarefa.", erro: true })
                        return ok
                      }}
                      onFechar={() => setNovaEm(null)}
                    />
                  ) : null}

                  {lista.slice(0, mostrando[coluna.chave] ?? JANELA_DA_COLUNA).map((c) => (
                    <CartaoKanban
                      key={c.grupo.chave}
                      cartao={c}
                      usuarios={usuarios}
                      eu={eu}
                      termos={termos}
                      arrastando={arrastando === c.grupo.chave}
                      onArrastar={() => setArrastando(c.grupo.chave)}
                      onSoltarFim={() => {
                        setArrastando(null)
                        setAlvo(null)
                      }}
                      agir={(corpo, texto, desfazer) => fazer(c.tarefa.id, corpo, texto, desfazer)}
                      onAbrir={() => setAberta(c.tarefa)}
                    />
                  ))}

                  {lista.length > (mostrando[coluna.chave] ?? JANELA_DA_COLUNA) ? (
                    <button
                      type="button"
                      onClick={() => setMostrando((m) => ({ ...m, [coluna.chave]: (m[coluna.chave] ?? JANELA_DA_COLUNA) + JANELA_DA_COLUNA }))}
                      className="rounded-xl border border-dashed border-foreground/15 py-2.5 text-center text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      Mostrar mais {Math.min(JANELA_DA_COLUNA, lista.length - (mostrando[coluna.chave] ?? JANELA_DA_COLUNA))} de {lista.length - (mostrando[coluna.chave] ?? JANELA_DA_COLUNA)} restantes
                    </button>
                  ) : null}

                  {lista.length === 0 && novaEm !== coluna.chave ? (
                    <button
                      type="button"
                      onClick={() => setNovaEm(coluna.chave)}
                      className={cn(
                        "rounded-xl border border-dashed py-6 text-center text-[13px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground",
                        arrastando ? "border-foreground/30" : "border-foreground/10"
                      )}
                    >
                      {arrastando ? "Solte aqui" : termos.length || soMinhas ? "Nada com esse filtro" : "Nenhuma tarefa. Criar uma"}
                    </button>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {aviso ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "animate-in fade-in slide-in-from-bottom-2 fixed inset-x-4 bottom-24 z-[80] mx-auto flex max-w-lg items-center gap-3 rounded-2xl px-4 py-3 text-[13px] shadow-float duration-200 md:bottom-6",
            aviso.erro ? "bg-orange-700 text-white" : "bg-foreground text-background"
          )}
        >
          <span className="min-w-0 flex-1">{aviso.texto}</span>
          {aviso.desfazer ? (
            <button
              type="button"
              onClick={aviso.desfazer}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none"
            >
              <Undo2 size={14} aria-hidden />
              Desfazer
            </button>
          ) : null}
          <button type="button" onClick={() => avisar(null)} aria-label="Fechar aviso" className="flex size-7 shrink-0 items-center justify-center rounded-md opacity-75 hover:opacity-100">
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

