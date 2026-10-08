"use client"

import { useMemo, useState } from "react"
import { Pagina } from "@/components/layout/pagina"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Segmentado } from "@/components/ui/segmentado"
import {
  ShieldCheck,
  Check,
  Pencil,
  Trash2,
  FileText,
  CalendarClock,
  Landmark,
  Send,
  type LucideIcon,
} from "lucide-react"

/**
 * Caixa de aprovações (protótipo, sem banco).
 *
 * O lugar único onde cai tudo que o agente e as automações PREPARARAM
 * e que mexe no mundo: peça, carta, prorrogação, mensagem ao cliente.
 * Nada sai daqui sem o "Aprovar" de uma pessoa — é a trava que o resto
 * do sistema aponta (assistente, automações, varredura).
 *
 * Em memória por enquanto; quando o backend existir, esta lista vem da
 * fila real e o "Aprovar" dispara a ação de verdade (sempre com registro).
 */

type Origem = "Assistente" | "Automação" | "Varredura"

type Pendencia = {
  id: string
  titulo: string
  cliente: string
  origem: Origem
  icone: LucideIcon
  detalhe: string
}

const SEED: Pendencia[] = [
  { id: "1", titulo: "Petição inicial — BPC/LOAS", cliente: "João Batista de Souza", origem: "Assistente", icone: FileText, detalhe: "Minuta visual law montada com a pasta do Drive. Falta sua revisão e assinatura." },
  { id: "2", titulo: "Carta de concessão", cliente: "Marinez Rocha da Silva", origem: "Automação", icone: Landmark, detalhe: "Benefício concedido; carta e memória de cálculo prontas para conferência." },
  { id: "3", titulo: "Pedido de prorrogação", cliente: "Maria das Graças Oliveira", origem: "Varredura", icone: CalendarClock, detalhe: "DCB em 20/10. Pedido montado — o envio no portal é seu." },
  { id: "4", titulo: "Impugnação a laudo desfavorável", cliente: "Francisca Pereira Matos", origem: "Automação", icone: FileText, detalhe: "Nova perícia como pedido principal (art. 480), com compromisso de depósito dos honorários." },
  { id: "5", titulo: "Mensagem ao cliente — perícia marcada", cliente: "Antônia Ferreira Lima", origem: "Varredura", icone: Send, detalhe: "Aviso com data, local e o que levar. Sai no seu nome — confira antes." },
]

const ORIGEM_VARIANTE: Record<Origem, "info" | "warning" | "secondary"> = {
  Assistente: "secondary",
  Automação: "warning",
  Varredura: "info",
}

export default function AprovacoesPage() {
  const [fila, setFila] = useState<Pendencia[]>(SEED)
  const [filtro, setFiltro] = useState<"TODAS" | Origem>("TODAS")

  const lista = useMemo(
    () => (filtro === "TODAS" ? fila : fila.filter((p) => p.origem === filtro)),
    [fila, filtro]
  )

  function decidir(id: string) {
    setFila((f) => f.filter((p) => p.id !== id))
  }

  return (
    <Pagina
      titulo="Aprovações"
      subtitulo="Tudo que o sistema preparou e espera o seu OK. Nada sai daqui sozinho."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant={fila.length > 0 ? "warning" : "muted"}>
          <ShieldCheck /> {fila.length} aguardando
        </Badge>
        <Segmentado
          aria-label="Filtrar por origem"
          valor={filtro}
          onChange={setFiltro}
          tamanho="sm"
          opcoes={[
            { valor: "TODAS", rotulo: "Todas" },
            { valor: "Assistente", rotulo: "Assistente" },
            { valor: "Automação", rotulo: "Automação" },
            { valor: "Varredura", rotulo: "Varredura" },
          ]}
        />
      </div>

      {lista.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nada para aprovar agora.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lista.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 py-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <p.icone size={17} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{p.titulo}</p>
                      <Badge variant={ORIGEM_VARIANTE[p.origem]}>{p.origem}</Badge>
                    </div>
                    <p className="text-[12.5px] text-muted-foreground">
                      {p.cliente}
                    </p>
                    <p className="mt-1 text-[13px]">{p.detalhe}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => decidir(p.id)}>
                    <Check size={15} /> Aprovar
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    <Pencil size={15} /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Descartar"
                    onClick={() => decidir(p.id)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Pagina>
  )
}
