"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Check,
  Copy,
  KeyRound,
  Loader2,
  MessageSquarePlus,
  Save,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LIMITE_HISTORICO } from "@/lib/domain/cliente"
import { cn } from "@/lib/utils"
import {
  formatarCpf,
  formatarData,
  type ComentarioCliente,
  type FichaCliente,
  type PatchFicha,
} from "./tipos"

/**
 * Ficha administrativa do titular, aberta dentro da própria fila.
 *
 * O que está aqui é o que a equipe consulta antes de ligar para o
 * cliente ou entrar no Meu INSS. O cadastro completo continua em
 * /clientes/[id] — o link no rodapé é a ponte.
 */

function Campo({
  rotulo,
  children,
  className,
}: {
  rotulo: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {rotulo}
      </p>
      <div className="mt-1 text-[13.5px] leading-snug">{children}</div>
    </div>
  )
}

/**
 * Copiar é o gesto que a tela realmente serve: CPF e senha existem
 * aqui para irem parar num formulário do gov.br daqui a três segundos.
 */
function BotaoCopiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false)

  return (
    <Button
      size="sm"
      variant="ghost"
      title={`Copiar ${rotulo}`}
      aria-label={`Copiar ${rotulo}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valor)
          setCopiado(true)
          window.setTimeout(() => setCopiado(false), 1500)
        } catch {
          // Navegador sem permissão de área de transferência: o valor
          // está à vista, dá para selecionar à mão.
        }
      }}
      className="px-2"
    >
      {copiado ? (
        <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy size={13} />
      )}
    </Button>
  )
}

/**
 * A senha aparece em claro, de propósito: a tela é interna e existe
 * para protocolar. Esconder atrás de um clique só somaria um clique.
 */
function SenhaMeuInss({
  senha,
  onSalvar,
}: {
  senha: string | null
  onSalvar: (senha: string) => Promise<void>
}) {
  const [carregando, setCarregando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState("")
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    setCarregando(true)
    setErro(null)
    try {
      await onSalvar(rascunho)
      setEditando(false)
      setRascunho("")
    } catch {
      setErro("Não foi possível salvar")
    } finally {
      setCarregando(false)
    }
  }

  if (editando) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          autoFocus
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          placeholder="Senha do gov.br"
          className="h-8 max-w-[220px] font-mono text-sm"
        />
        <Button size="sm" onClick={salvar} disabled={carregando}>
          {carregando ? (
            <Loader2 size={13} className="mr-1 animate-spin" />
          ) : (
            <Save size={13} className="mr-1" />
          )}
          Salvar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditando(false)
            setRascunho("")
          }}
        >
          Cancelar
        </Button>
        {erro ? <span className="text-xs text-destructive">{erro}</span> : null}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span
        className={cn(
          "inline-flex h-8 min-w-[110px] items-center rounded-lg bg-muted px-2.5 font-mono text-[13.5px] font-medium tracking-wide select-all",
          !senha && "font-sans text-muted-foreground italic tracking-normal"
        )}
      >
        {senha ?? "não cadastrada"}
      </span>

      {senha ? <BotaoCopiar valor={senha} rotulo="senha do Meu INSS" /> : null}

      <Button
        size="sm"
        variant="ghost"
        onClick={() => setEditando(true)}
        title={senha ? "Trocar senha" : "Cadastrar senha"}
      >
        <KeyRound size={13} className="mr-1" />
        {senha ? "Trocar" : "Cadastrar"}
      </Button>

      {erro ? <span className="text-xs text-destructive">{erro}</span> : null}
    </div>
  )
}

function quando(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`
}

/**
 * O histórico de comentários: quem escreveu, quando, o quê — do mais
 * novo ao mais velho.
 *
 * É uma lista e não um campo de texto porque duas pessoas cuidam do
 * mesmo cliente. Num campo só, o segundo recado apagava o primeiro sem
 * deixar rastro; aqui cada um fica com nome e hora, e ninguém
 * sobrescreve ninguém. Só os LIMITE_HISTORICO mais recentes ficam: a
 * ficha é para ser lida de relance, e o que importa é o que foi
 * combinado por último.
 */
function HistoricoComentarios({ historico }: { historico: ComentarioCliente[] }) {
  if (historico.length === 0) {
    return (
      <p className="mt-1 text-[13px] text-muted-foreground italic">
        Nenhum comentário ainda.
      </p>
    )
  }

  return (
    <ol className="mt-1 space-y-1.5" aria-label="Histórico de comentários">
      {historico.map((c, i) => (
        <li
          key={c.id}
          className={cn(
            "rounded-lg border border-foreground/10 bg-card px-3 py-2",
            // O mais recente é o que a equipe procura: ganha o texto
            // cheio; os anteriores ficam em tom de contexto.
            i > 0 && "text-muted-foreground"
          )}
        >
          <p className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">
              {c.autor?.name ?? "Registro sem autor"}
            </span>
            <time dateTime={c.criadoEm} className="tabular-nums">
              {quando(c.criadoEm)}
            </time>
          </p>
          <p className="mt-0.5 text-[13.5px] leading-relaxed whitespace-pre-wrap">
            {c.texto}
          </p>
        </li>
      ))}
    </ol>
  )
}

/**
 * Onde a ficha está montada.
 *
 * `painel` é a gaveta da lista: ela abre colada na linha do cliente e
 * precisa da borda e do fundo para se distinguir dela. `caixa` é a
 * janela do kanban, onde a moldura já é do diálogo — repetir fundo e
 * borda ali daria duas caixas, uma dentro da outra.
 */
export type MolduraFicha = "painel" | "caixa"

export function FichaClienteAdministrativa({
  cliente,
  onSalvarFicha,
  moldura = "painel",
}: {
  cliente: FichaCliente
  onSalvarFicha: (patch: PatchFicha) => Promise<void>
  moldura?: MolduraFicha
}) {
  const [comentario, setComentario] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const historico = cliente.historico ?? []
  const podeRegistrar = comentario.trim().length > 0

  async function registrarComentario() {
    if (!podeRegistrar) return
    setSalvando(true)
    setSalvo(false)
    setErro(null)
    try {
      await onSalvarFicha({ comentario: comentario.trim() })
      // O registro entrou no histórico (que chega atualizado pela
      // fila); a caixa esvazia para o próximo.
      setComentario("")
      setSalvo(true)
    } catch {
      setErro("Não foi possível registrar")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className={cn(
        moldura === "painel"
          ? "rounded-b-lg border-t border-foreground/10 bg-muted/40 px-4 py-4"
          : "px-0.5 py-0.5"
      )}
    >
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          moldura === "painel" && "xl:grid-cols-4"
        )}
      >
        <Campo rotulo="Cliente">
          <span className="font-medium">{cliente.nome}</span>
        </Campo>

        <Campo rotulo="CPF">
          {formatarCpf(cliente.cpf) ? (
            <span className="flex items-center gap-1">
              <span className="font-mono text-[13.5px] font-medium select-all">
                {formatarCpf(cliente.cpf)}
              </span>
              <BotaoCopiar valor={formatarCpf(cliente.cpf) as string} rotulo="CPF" />
            </span>
          ) : (
            <span className="text-muted-foreground italic">não informado</span>
          )}
        </Campo>

        <Campo rotulo="Cadastrado em">
          {formatarData(cliente.criadoEm) ?? "—"}
        </Campo>

        <Campo rotulo="Senha do Meu INSS" className="xl:col-span-1">
          <SenhaMeuInss
            senha={cliente.senhaMeuInss}
            onSalvar={(senha) => onSalvarFicha({ senhaMeuInss: senha })}
          />
        </Campo>
      </div>

      <div className="mt-4">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Histórico de comentários
          <span className="font-normal tracking-normal normal-case">
            os {LIMITE_HISTORICO} mais recentes
          </span>
        </p>

        <HistoricoComentarios historico={historico} />

        <label
          htmlFor={`novo-comentario-${cliente.id}`}
          className="mt-3 block text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
        >
          Novo comentário
        </label>
        <textarea
          id={`novo-comentario-${cliente.id}`}
          value={comentario}
          onChange={(e) => {
            setComentario(e.target.value)
            setSalvo(false)
            setErro(null)
          }}
          onKeyDown={(e) => {
            // Ctrl/Cmd+Enter registra: quem digita um recado curto não
            // quer soltar o teclado para clicar.
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              registrarComentario()
            }
          }}
          rows={2}
          placeholder="Combinados, pendências, o que já foi tentado — fica registrado com seu nome e a hora."
          className="mt-1 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] leading-relaxed outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50"
        />

        <div className="mt-2 flex items-center gap-3">
          <Button
            size="sm"
            onClick={registrarComentario}
            disabled={!podeRegistrar || salvando}
          >
            {salvando ? (
              <Loader2 size={13} className="mr-1 animate-spin" />
            ) : (
              <MessageSquarePlus size={13} className="mr-1" />
            )}
            Registrar comentário
          </Button>

          {salvo && !podeRegistrar ? (
            <span className="text-xs text-muted-foreground">Registrado.</span>
          ) : null}

          {erro ? <span className="text-xs text-destructive">{erro}</span> : null}

          <Link
            href={`/clientes/${cliente.id}`}
            className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline dark:text-blue-400"
          >
            Abrir pasta completa
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
