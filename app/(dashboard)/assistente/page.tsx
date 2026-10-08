"use client"

import { useState } from "react"
import { Pagina } from "@/components/layout/pagina"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  Send,
  Check,
  Pencil,
  Trash2,
  Loader2,
  ListChecks,
  UserPlus,
  FileText,
  CalendarClock,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

/**
 * Assistente por comando (protótipo visual, sem banco e sem IA ligada).
 *
 * É a cara da C2 Prev: você pede em português ("cadastra esse cliente",
 * "faz a inicial") e o sistema PREPARA a ação. Aqui a interpretação é
 * simulada por palavra-chave, só para mostrar o fluxo — quando a
 * ANTHROPIC_API_KEY entrar, a leitura do pedido vira de verdade
 * (lib/ia já existe no projeto).
 *
 * A regra que não muda: o assistente NÃO executa sozinho. Todo pedido
 * vira um plano que espera o "Aprovar" de uma pessoa (a fila S21 do
 * mapa). Nada que mexe em processo, protocolo ou INSS sai daqui sem
 * esse clique — é o mesmo princípio da varredura e do preparo de
 * protocolo que já estão no sistema.
 */

type Acao =
  | "CADASTRAR_CLIENTE"
  | "PETICAO_INICIAL"
  | "CARTA_CONCESSAO"
  | "CRIAR_TAREFA"
  | "PRORROGACAO"
  | "DESCONHECIDO"

type Plano = {
  id: string
  comando: string
  acao: Acao
  titulo: string
  icone: LucideIcon
  linhas: string[]
  // Ações que mexem no mundo (peça, protocolo, INSS) carregam um aviso
  // de que param na revisão. Cadastro e tarefa não precisam.
  aviso: string | null
  estado: "PENDENTE" | "APROVADA" | "RECUSADA"
}

const EXEMPLOS = [
  "Cadastra a cliente Maria das Graças, CPF 000.000.000-00, auxílio-doença",
  "Faz a inicial do João Batista (BPC/LOAS)",
  "Monta a carta de concessão da Marinez",
  "Cria tarefa pro time amarelo: ligar pra Antônia hoje",
  "Prepara a prorrogação do auxílio da Marinez",
]

let contador = 0

function interpretar(comando: string): Plano {
  const t = comando.toLowerCase()
  const base = { id: `p${++contador}`, comando, estado: "PENDENTE" as const }

  if (/cadastr|novo cliente|nova cliente/.test(t))
    return {
      ...base,
      acao: "CADASTRAR_CLIENTE",
      titulo: "Cadastrar cliente",
      icone: UserPlus,
      linhas: [
        "Cria a ficha com nome, CPF e benefício buscado",
        "Abre a pasta do cliente e lança a tarefa de análise",
      ],
      aviso: null,
    }

  if (/inicial|peti[çc][ãa]o|a[çc][ãa]o judicial|judicializ/.test(t))
    return {
      ...base,
      acao: "PETICAO_INICIAL",
      titulo: "Montar petição inicial (visual law)",
      icone: FileText,
      linhas: [
        "Usa o modelo visual law do escritório e a pasta do cliente",
        "Checa carência e qualidade de segurado na DER",
        "Gera o PDF e deixa na fila de revisão",
      ],
      aviso: "Fica pronta para sua revisão — assinatura e protocolo são seus.",
    }

  if (/carta|concess/.test(t))
    return {
      ...base,
      acao: "CARTA_CONCESSAO",
      titulo: "Montar carta de concessão",
      icone: FileText,
      linhas: [
        "Lê o extrato e a carta do INSS da pasta",
        "Calcula retroativo e honorários no padrão do escritório",
        "Gera o PDF visual law para conferência",
      ],
      aviso: "Confira os valores antes de enviar ao cliente.",
    }

  if (/tarefa|lembrete|avisar|ligar/.test(t))
    return {
      ...base,
      acao: "CRIAR_TAREFA",
      titulo: "Criar tarefa",
      icone: ListChecks,
      linhas: [
        "Lança a tarefa no time indicado, com prazo",
        "Aparece no quadro de tarefas da equipe",
      ],
      aviso: null,
    }

  if (/prorrog|dcb|cessa/.test(t))
    return {
      ...base,
      acao: "PRORROGACAO",
      titulo: "Preparar pedido de prorrogação",
      icone: CalendarClock,
      linhas: [
        "Confere a DCB e se a prorrogação já foi pedida",
        "Monta o pedido com a pasta do Drive",
        "Coloca na fila de revisão da Central do INSS",
      ],
      aviso: "O envio no portal é seu — o assistente não protocola sozinho.",
    }

  return {
    ...base,
    acao: "DESCONHECIDO",
    titulo: "Não entendi o pedido ainda",
    icone: Sparkles,
    linhas: [
      "Reformule com o nome do cliente e o que fazer",
      "Ex.: “cadastra a Ana, CPF …, salário-maternidade”",
    ],
    aviso: null,
  }
}

function SeloEstado({ estado }: { estado: Plano["estado"] }) {
  if (estado === "APROVADA")
    return (
      <Badge variant="success">
        <Check /> aprovada
      </Badge>
    )
  if (estado === "RECUSADA")
    return (
      <Badge variant="muted">
        <Trash2 /> recusada
      </Badge>
    )
  return (
    <Badge variant="warning">
      <ShieldCheck /> aguardando aprovação
    </Badge>
  )
}

export default function AssistentePage() {
  const [comando, setComando] = useState("")
  const [pensando, setPensando] = useState(false)
  const [pendente, setPendente] = useState<Plano | null>(null)
  const [historico, setHistorico] = useState<Plano[]>([])

  function enviar(texto?: string) {
    const cmd = (texto ?? comando).trim()
    if (!cmd || pensando) return
    setPensando(true)
    setPendente(null)
    // Simula a "leitura" do pedido. Com a API ligada, vira chamada real.
    setTimeout(() => {
      setPendente(interpretar(cmd))
      setComando("")
      setPensando(false)
    }, 650)
  }

  function decidir(estado: "APROVADA" | "RECUSADA") {
    if (!pendente) return
    setHistorico((h) => [{ ...pendente, estado }, ...h])
    setPendente(null)
  }

  return (
    <Pagina
      titulo="Assistente"
      subtitulo="Peça em português. O assistente prepara e você aprova. Protótipo — IA ainda não ligada."
    >
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <Sparkles size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <p>
          Protótipo: a interpretação é simulada por palavra-chave e nada é
          executado. Ligar a leitura de verdade precisa da{" "}
          <strong>ANTHROPIC_API_KEY</strong> no <code>.env</code>. A regra fica:
          todo pedido vira um plano que <strong>espera o seu “Aprovar”</strong>.
        </p>
      </div>

      {/* Caixa de comando */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-3 left-3 text-brand">
                <Sparkles size={16} strokeWidth={2} />
              </span>
              <textarea
                value={comando}
                onChange={(e) => setComando(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enviar()
                }}
                rows={2}
                placeholder="Ex.: cadastra a Maria, CPF 000.000.000-00, auxílio-doença"
                className="min-h-11 w-full resize-none rounded-lg border border-input bg-card py-2.5 pr-3 pl-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
              />
            </div>
            <Button onClick={() => enviar()} disabled={pensando || !comando.trim()}>
              {pensando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Enviar
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {EXEMPLOS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => enviar(ex)}
                disabled={pensando}
                className="rounded-full border border-border bg-muted px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plano aguardando aprovação (S21) */}
      {pendente && (
        <Card className="border-blue-300 dark:border-blue-900">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <pendente.icone size={17} strokeWidth={1.9} className="text-brand" />
              {pendente.titulo}
            </CardTitle>
            <SeloEstado estado={pendente.estado} />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[12.5px] text-muted-foreground">
              Do pedido: “{pendente.comando}”
            </p>
            <ul className="space-y-1 text-sm">
              {pendente.linhas.map((l, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-brand" />
                  {l}
                </li>
              ))}
            </ul>
            {pendente.aviso && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {pendente.aviso}
              </p>
            )}
            {pendente.acao !== "DESCONHECIDO" && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={() => decidir("APROVADA")}>
                  <Check size={15} /> Aprovar
                </Button>
                <Button variant="outline" size="sm" disabled>
                  <Pencil size={15} /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => decidir("RECUSADA")}
                >
                  <Trash2 size={15} /> Descartar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico de aprovações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[14px]">Aprovações</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nada ainda. O que você aprovar ou recusar aparece aqui.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {historico.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-2 border-b border-border/60 py-2 last:border-0"
                >
                  <p.icone
                    size={16}
                    strokeWidth={1.9}
                    className="shrink-0 text-muted-foreground"
                  />
                  <span className="font-medium">{p.titulo}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
                    “{p.comando}”
                  </span>
                  <SeloEstado estado={p.estado} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </Pagina>
  )
}
