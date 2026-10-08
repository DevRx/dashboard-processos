"use client"

import { useEffect, useRef, useState } from "react"
import { Pagina } from "@/components/layout/pagina"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, Send, Loader2, ShieldCheck } from "lucide-react"

/**
 * Assistente — o agente do escritório com que a equipe conversa.
 *
 * Fala com /api/assistente, que usa lib/ia/agente-escritorio (modelo
 * claude-opus-5) e a base de conhecimento do escritório. Sem
 * ANTHROPIC_API_KEY a resposta vem como aviso, não como erro.
 *
 * O agente responde, explica e prepara minutas; ele não executa nada —
 * toda ação que mexe em processo, protocolo ou INSS fica como rascunho
 * para a aprovação do advogado.
 */

type Mensagem = { autor: "pessoa" | "agente"; texto: string; aviso?: boolean }

const EXEMPLOS = [
  "Qual a nossa estratégia quando o administrativo é negado?",
  "Como monto a impugnação de um laudo desfavorável?",
  "Me faz um checklist pra abrir um BPC/LOAS",
  "Resume pra mim como fica o fecho de uma petição",
]

export default function AssistentePage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensagens, enviando])

  async function enviar(entrada?: string) {
    const pergunta = (entrada ?? texto).trim()
    if (!pergunta || enviando) return

    const historico = mensagens
      .filter((m) => !m.aviso)
      .map((m) => ({ autor: m.autor, texto: m.texto }))

    setMensagens((m) => [...m, { autor: "pessoa", texto: pergunta }])
    setTexto("")
    setEnviando(true)

    try {
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta, historico }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensagens((m) => [
          ...m,
          {
            autor: "agente",
            texto: data.error ?? "Não consegui responder agora.",
            aviso: true,
          },
        ])
      } else {
        setMensagens((m) => [...m, { autor: "agente", texto: data.resposta }])
      }
    } catch {
      setMensagens((m) => [
        ...m,
        { autor: "agente", texto: "Erro de conexão. Tente de novo.", aviso: true },
      ])
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Pagina
      titulo="Assistente"
      subtitulo="Converse com o agente do escritório. Ele responde e prepara — o advogado aprova."
    >
      <Card className="flex h-[calc(100vh-13rem)] min-h-[420px] flex-col">
        <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden p-0">
          {/* Thread */}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {mensagens.length === 0 && (
              <div className="mx-auto max-w-lg py-8 text-center">
                <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <Sparkles size={24} strokeWidth={1.9} />
                </span>
                <p className="font-heading text-[15px] font-semibold">
                  O que você precisa?
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Pergunte sobre estratégia, prazos e peças, ou peça uma minuta.
                  O agente usa a base do escritório e deixa qualquer ação para a
                  sua aprovação.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {EXEMPLOS.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => enviar(ex)}
                      className="rounded-full border border-border bg-muted px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensagens.map((m, i) => (
              <div
                key={i}
                className={
                  m.autor === "pessoa" ? "flex justify-end" : "flex justify-start"
                }
              >
                <div
                  className={
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap " +
                    (m.autor === "pessoa"
                      ? "bg-primary text-primary-foreground"
                      : m.aviso
                        ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                        : "bg-muted text-foreground")
                  }
                >
                  {m.texto}
                </div>
              </div>
            ))}

            {enviando && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2 size={15} className="animate-spin" /> pensando…
                </div>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          {/* Caixa de envio */}
          <div className="border-t border-border p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    enviar()
                  }
                }}
                rows={1}
                placeholder="Escreva aqui… (Enter envia, Shift+Enter quebra linha)"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
              />
              <Button onClick={() => enviar()} disabled={enviando || !texto.trim()}>
                {enviando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Enviar
              </Button>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <ShieldCheck size={13} className="shrink-0" />
              O agente prepara e explica; ele não protocola nem acessa o INSS
              sozinho. Precisa da ANTHROPIC_API_KEY para responder.
            </p>
          </div>
        </CardContent>
      </Card>
    </Pagina>
  )
}
