"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { Bot, Check, Copy, KeyRound, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useUsuario } from "@/components/layout/usuario-context"
import { cn } from "@/lib/utils"

type Chave = {
  id: string
  nome: string
  prefixo: string
  criadaEm: string
  ultimoUsoEm: string | null
  revogadaEm: string | null
  conta: string | null
}

type Estado = {
  tabelaPronta: boolean
  aviso?: string
  conta: { id: string; name: string } | null
  chaves: Chave[]
}

const semAssinatura = () => () => {}

function quando(iso: string | null) {
  if (!iso) return "nunca"
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

/** Um valor para copiar: em letra de máquina, com o botão ao lado. */
function Copiavel({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{rotulo}</p>
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 ring-1",
          destaque ? "bg-emerald-50 ring-emerald-300 dark:bg-emerald-950/40 dark:ring-emerald-800" : "bg-muted/50 ring-border"
        )}
      >
        <code className="min-w-0 flex-1 font-mono text-[13px] break-all">{valor}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Copiar: ${rotulo}`}
          onClick={async () => {
            await navigator.clipboard.writeText(valor).catch(() => {})
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1600)
          }}
        >
          {copiado ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
        </Button>
      </div>
    </div>
  )
}

/**
 * Configurações › Conectar o Claude (só para o administrador).
 *
 * O Claude entra no sistema como um responsável da equipe, por um
 * conector (app/api/mcp) que ele usa com uma chave. Aqui o
 * administrador gera a chave — a conta "Claude" nasce junto, se ainda
 * não existir —, vê o endereço do conector e revoga o que não usa mais.
 */
export function ConectarClaude() {
  const eu = useUsuario()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [nova, setNova] = useState<string | null>(null)
  const [revogar, setRevogar] = useState<string | null>(null)
  // O endereço é o deste site: no servidor não há como saber, e o HTML
  // sai sem ele.
  const endereco = useSyncExternalStore(
    semAssinatura,
    () => `${window.location.origin}/api/mcp`,
    () => ""
  )

  const carregar = useCallback(() => {
    fetch("/api/integracoes/claude")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Estado) => setEstado(d))
      .catch(() => setErro("Não foi possível carregar as chaves."))
  }, [])

  useEffect(() => {
    if (eu?.role !== "ADMIN") return
    carregar()
  }, [eu?.role, carregar])

  if (eu?.role !== "ADMIN") return null

  const gerar = async () => {
    setGerando(true)
    setErro(null)
    const r = await fetch("/api/integracoes/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "gerar" }),
    }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setGerando(false)
    if (!r?.ok) {
      setErro(d.error ?? "Não foi possível gerar a chave.")
      return
    }
    setNova(d.chave)
    carregar()
  }

  const confirmarRevogacao = async (id: string) => {
    setRevogar(null)
    const r = await fetch("/api/integracoes/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "revogar", id }),
    }).catch(() => null)
    if (!r?.ok) setErro("Não foi possível revogar a chave.")
    carregar()
  }

  const ativas = estado?.chaves.filter((c) => !c.revogadaEm) ?? []
  const revogadas = estado?.chaves.filter((c) => c.revogadaEm) ?? []

  return (
    <section className="overflow-hidden rounded-xl bg-card shadow-card">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Bot size={17} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-[15px] font-semibold">Conectar o Claude</h2>
          <p className="text-xs leading-snug text-muted-foreground">
            O Claude trabalha nas tarefas como alguém da equipe: vê as que estão com ele, move no fluxo, conclui a
            parte dele e abre dúvidas. Tudo fica no histórico em nome dele.
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {estado === null && !erro ? (
          <Skeleton className="h-24 w-full" />
        ) : null}

        {estado && !estado.tabelaPronta ? (
          <p className="flex gap-2 rounded-lg bg-orange-50 px-3 py-2 text-[13px] leading-snug text-orange-900 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            {estado.aviso}
          </p>
        ) : null}

        {erro ? (
          <p className="rounded-lg bg-orange-50 px-3 py-2 text-[13px] text-orange-900 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900">
            {erro}
          </p>
        ) : null}

        {estado?.tabelaPronta ? (
          <>
            {nova ? (
              <Copiavel
                rotulo="URL do conector, já com a chave — copie agora, ela não aparece de novo"
                valor={`${endereco}/${nova}`}
                destaque
              />
            ) : (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-[13px] leading-snug text-muted-foreground ring-1 ring-border">
                Gere uma chave para ver a URL do conector. A URL leva a chave dentro dela: trate como uma senha.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button type="button" onClick={gerar} disabled={gerando}>
                <KeyRound size={15} />
                {gerando ? "Gerando…" : ativas.length ? "Gerar outra chave" : "Gerar chave"}
              </Button>
              <span className="text-xs leading-snug text-muted-foreground">
                {estado.conta
                  ? `A chave entra na conta "${estado.conta.name}".`
                  : 'A conta "Claude" será criada junto com a primeira chave.'}
              </span>
            </div>

            <ol className="list-decimal space-y-1.5 rounded-lg bg-muted/40 py-3 pr-3 pl-8 text-[13px] leading-snug">
              <li>
                No Claude, abra <b>Personalizar › Conectores</b> (Customize › Connectors), clique em <b>+</b> e em{" "}
                <b>Adicionar conector personalizado</b>.
              </li>
              <li>
                Nome: <b>Dashboard Processos</b>. URL: a de cima, com a chave.
              </li>
              <li>
                Autenticação: <b>sem login</b> (No sign in). Não preencha OAuth Client ID nem cabeçalhos.
              </li>
              <li>Salve e clique em Conectar. Pronto: o Claude passa a ver as ferramentas do sistema.</li>
            </ol>

            {ativas.length || revogadas.length ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Chaves</p>
                <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
                  {[...ativas, ...revogadas].map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className={cn("block font-mono text-[13px]", c.revogadaEm && "text-muted-foreground line-through")}>
                          {c.prefixo}…
                        </span>
                        <span className="block text-xs leading-snug text-muted-foreground">
                          {c.conta ?? "—"} · criada {quando(c.criadaEm)} · último uso {quando(c.ultimoUsoEm)}
                          {c.revogadaEm ? ` · revogada ${quando(c.revogadaEm)}` : ""}
                        </span>
                      </span>
                      {!c.revogadaEm ? (
                        revogar === c.id ? (
                          <span className="flex gap-1.5">
                            <Button type="button" size="sm" variant="destructive" onClick={() => confirmarRevogacao(c.id)}>
                              Revogar mesmo
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setRevogar(null)}>
                              Cancelar
                            </Button>
                          </span>
                        ) : (
                          <Button type="button" size="sm" variant="outline" onClick={() => setRevogar(c.id)}>
                            Revogar
                          </Button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
