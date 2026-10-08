"use client"

import { useState } from "react"
import { Pagina } from "@/components/layout/pagina"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Segmentado } from "@/components/ui/segmentado"
import {
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ListPlus,
  Check,
  Trash2,
} from "lucide-react"

/**
 * Automações (protótipo visual, sem banco e sem execução).
 *
 * A C2 Prev vende "a IA age sozinha: automações que disparam no
 * momento certo". Aqui o mesmo conceito, com a regra do escritório:
 * ação sensível (protocolar, enviar, mexer no INSS, avisar cliente)
 * NÃO roda sozinha — nasce em modo "Revisão" e cai na fila de
 * aprovação. Só o que é interno e reversível (abrir tarefa, mover
 * cartão, registrar andamento) pode ser "Automático".
 *
 * Isto é a tela. O motor que dispara as regras roda como serviço no
 * servidor (igual ao DJEN) e grava tudo — não dentro do chat.
 */

type Modo = "AUTOMATICO" | "REVISAO"

type Regra = {
  id: string
  quando: string
  se: string
  entao: string
  modo: Modo
  ativa: boolean
  /** Ação que mexe no mundo: trava em Revisão, não deixa virar Automático. */
  sensivel: boolean
}

const SEED: Regra[] = [
  {
    id: "1",
    quando: "Exigência detectada no INSS",
    se: "tem prazo",
    entao: "cria tarefa no time responsável, com o prazo na agenda",
    modo: "AUTOMATICO",
    ativa: true,
    sensivel: false,
  },
  {
    id: "2",
    quando: "Intimação de sentença publicada",
    se: "é do nosso processo",
    entao: "avisa o advogado e abre tarefa",
    modo: "AUTOMATICO",
    ativa: true,
    sensivel: false,
  },
  {
    id: "3",
    quando: "Benefício aparece concedido",
    se: "tem extrato na pasta",
    entao: "prepara a carta de concessão para revisão",
    modo: "REVISAO",
    ativa: true,
    sensivel: true,
  },
  {
    id: "4",
    quando: "DCB a vencer em 15 dias",
    se: "prorrogação ainda não pedida",
    entao: "monta o pedido de prorrogação e põe na fila de revisão",
    modo: "REVISAO",
    ativa: true,
    sensivel: true,
  },
  {
    id: "5",
    quando: "Laudo pericial desfavorável juntado",
    se: "—",
    entao: "prepara a impugnação (nova perícia como pedido principal)",
    modo: "REVISAO",
    ativa: false,
    sensivel: true,
  },
]

let seq = 100

function SeloModo({ modo }: { modo: Modo }) {
  return modo === "AUTOMATICO" ? (
    <Badge variant="info">
      <RefreshCw /> automático
    </Badge>
  ) : (
    <Badge variant="warning">
      <ShieldCheck /> revisão
    </Badge>
  )
}

export default function AutomacoesPage() {
  const [regras, setRegras] = useState<Regra[]>(SEED)
  const [abrindo, setAbrindo] = useState(false)
  const [quando, setQuando] = useState("")
  const [se, setSe] = useState("")
  const [entao, setEntao] = useState("")
  const [modo, setModo] = useState<Modo>("REVISAO")
  const [sensivel, setSensivel] = useState(true)

  function alternar(id: string) {
    setRegras((rs) =>
      rs.map((r) => (r.id === id ? { ...r, ativa: !r.ativa } : r))
    )
  }

  function remover(id: string) {
    setRegras((rs) => rs.filter((r) => r.id !== id))
  }

  function adicionar() {
    if (!quando.trim() || !entao.trim()) return
    setRegras((rs) => [
      {
        id: `r${++seq}`,
        quando: quando.trim(),
        se: se.trim() || "—",
        entao: entao.trim(),
        // Sensível nunca nasce automático, mesmo que peçam.
        modo: sensivel ? "REVISAO" : modo,
        ativa: true,
        sensivel,
      },
      ...rs,
    ])
    setQuando("")
    setSe("")
    setEntao("")
    setModo("REVISAO")
    setSensivel(true)
    setAbrindo(false)
  }

  return (
    <Pagina
      titulo="Automações"
      subtitulo="Regras que disparam no momento certo. O sensível nasce em revisão. Protótipo."
      acoes={
        <Button size="sm" onClick={() => setAbrindo((v) => !v)}>
          <ListPlus size={16} /> Nova automação
        </Button>
      }
    >
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <p>
          Protótipo: as regras não disparam ainda. A regra que vale:{" "}
          <strong>ação sensível</strong> (protocolar, enviar, mexer no INSS,
          avisar cliente) só em <strong>Revisão</strong> — cai na fila de
          aprovação. Automático fica para o interno e reversível (abrir tarefa,
          registrar andamento).
        </p>
      </div>

      {abrindo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Nova automação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                Quando (gatilho)
                <Input
                  value={quando}
                  onChange={(e) => setQuando(e.target.value)}
                  placeholder="Ex.: exigência detectada"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Se (condição)
                <Input
                  value={se}
                  onChange={(e) => setSe(e.target.value)}
                  placeholder="Ex.: tem prazo"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Então (ação)
                <Input
                  value={entao}
                  onChange={(e) => setEntao(e.target.value)}
                  placeholder="Ex.: cria tarefa com prazo"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sensivel}
                  onChange={(e) => setSensivel(e.target.checked)}
                />
                Ação sensível (mexe no mundo)
              </label>
              <Segmentado
                aria-label="Modo da automação"
                valor={sensivel ? "REVISAO" : modo}
                onChange={(v) => !sensivel && setModo(v)}
                tamanho="sm"
                opcoes={[
                  { valor: "AUTOMATICO", rotulo: "Automático", tom: "info" },
                  { valor: "REVISAO", rotulo: "Revisão", tom: "alerta" },
                ]}
              />
              {sensivel && (
                <span className="text-[12px] text-muted-foreground">
                  sensível fica em Revisão
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={adicionar}
                disabled={!quando.trim() || !entao.trim()}
              >
                <Check size={15} /> Adicionar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAbrindo(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {regras.map((r) => (
          <Card key={r.id} className={r.ativa ? "" : "opacity-60"}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div className="min-w-0 space-y-1">
                <p className="text-sm">
                  <span className="font-semibold">Quando</span> {r.quando}
                  {r.se !== "—" && (
                    <>
                      {" "}
                      · <span className="font-semibold">se</span> {r.se}
                    </>
                  )}{" "}
                  · <span className="font-semibold">então</span> {r.entao}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <SeloModo modo={r.modo} />
                  {r.sensivel && (
                    <span className="text-[11.5px] text-muted-foreground">
                      sensível — sempre revisão
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={r.ativa ? "outline" : "default"}
                  size="sm"
                  onClick={() => alternar(r.id)}
                >
                  {r.ativa ? "Pausar" : "Ativar"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Remover automação"
                  onClick={() => remover(r.id)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Pagina>
  )
}
