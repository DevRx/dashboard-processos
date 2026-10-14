"use client"

import { useCallback, useEffect, useState } from "react"
import { MessageCircle, Lock, Unlock, Loader2 } from "lucide-react"

import { useUsuario } from "@/components/layout/usuario-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * A trava do aviso ao cliente — a única automação desta tela que está
 * ligada ao banco de verdade.
 *
 * O motor do DJEN lê a perícia da intimação e abre a tarefa "avisar o
 * cliente" com a mensagem pronta. Daí para a frente há duas vidas:
 * desligado, a equipe (ou o Claude, a pedido) envia e conclui;
 * ligado, a rotina do Claude pode enviar sozinha pelo WhatsApp. O
 * Zeca pediu que nascesse desligado e que só ele ligasse.
 */

type Configuracao = {
  chave: string
  valor: unknown
  descricao: string
  atualizadaEm: string | null
  atualizadaPor: { id: string; name: string } | null
  padrao: boolean
}

const CHAVE = "aviso_cliente_whatsapp"

function quando(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
}

export function AvisoClienteWhatsapp() {
  const eu = useUsuario()
  const [config, setConfig] = useState<Configuracao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    fetch("/api/configuracoes")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json) => setConfig((json?.configuracoes as Configuracao[] | undefined)?.find((x) => x.chave === CHAVE) ?? null))
      .catch(() => setConfig(null))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function alternar() {
    if (!config || salvando) return
    const novo = config.valor !== true
    if (novo && !window.confirm("Ligar o envio automático? A partir daí a rotina pode mandar ao cliente, pelo WhatsApp, o aviso de perícia lido da intimação.")) return
    setSalvando(true)
    setErro(null)
    const r = await fetch("/api/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave: CHAVE, valor: novo }),
    }).catch(() => null)
    const json = r ? await r.json().catch(() => ({})) : {}
    setSalvando(false)
    if (!r?.ok) {
      setErro(json.error ?? "Não foi possível gravar agora.")
      return
    }
    setConfig((json.configuracoes as Configuracao[]).find((x) => x.chave === CHAVE) ?? null)
  }

  const ligado = config?.valor === true
  const admin = eu?.role === "ADMIN"

  return (
    <section
      className={cn(
        "rounded-xl bg-card shadow-card ring-1",
        ligado ? "ring-emerald-300/70 dark:ring-emerald-800" : "ring-border"
      )}
    >
      <div className="flex flex-wrap items-start gap-4 px-5 py-4">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            ligado ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200" : "bg-muted text-muted-foreground"
          )}
        >
          <MessageCircle size={22} strokeWidth={1.9} />
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-[15px] leading-tight font-semibold">Aviso de perícia ao cliente pelo WhatsApp</p>
            {carregando ? (
              <Badge variant="secondary">…</Badge>
            ) : ligado ? (
              <Badge variant="success">
                <Unlock /> ligado
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Lock /> desligado
              </Badge>
            )}
          </div>
          <p className="text-[13px] leading-snug text-muted-foreground">
            O motor do DJEN lê a perícia ou audiência da intimação (dia, hora e lugar) e abre a tarefa{" "}
            <strong>Avisar cliente</strong> em Amarelo › Judicial › Andamentos, na véspera, com a mensagem pronta.
            {ligado
              ? " Com o envio ligado, a rotina do Claude manda a mensagem pelo WhatsApp e conclui a parte dela."
              : " Enquanto estiver desligado, ninguém envia sozinho: a equipe manda a mensagem e conclui a tarefa."}
          </p>
          {config && !config.padrao && config.atualizadaEm && (
            <p className="text-xs text-muted-foreground">
              {ligado ? "Ligado" : "Desligado"} por {config.atualizadaPor?.name ?? "—"} em {quando(config.atualizadaEm)}.
            </p>
          )}
          {config?.padrao && !carregando && (
            <p className="text-xs text-muted-foreground">
              A tabela de configurações ainda não existe no banco: vale o padrão, desligado. Rode a migration{" "}
              <code className="rounded bg-muted px-1">20261014220000_intimacao_evento_aviso.sql</code> para poder ligar.
            </p>
          )}
          {erro && <p className="text-xs text-red-700 dark:text-red-300">{erro}</p>}
        </div>

        {admin && (
          <Button
            size="sm"
            variant={ligado ? "outline" : "default"}
            onClick={alternar}
            disabled={carregando || salvando || !config}
            aria-pressed={ligado}
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : ligado ? <Lock size={15} /> : <Unlock size={15} />}
            {ligado ? "Desligar envio" : "Ligar envio"}
          </Button>
        )}
      </div>
    </section>
  )
}
