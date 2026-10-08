"use client"

import { useState } from "react"
import { Pagina } from "@/components/layout/pagina"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Segmentado } from "@/components/ui/segmentado"
import { CheckCircle2, AlertTriangle, Baby } from "lucide-react"

/**
 * Salário-maternidade (protótipo, sem banco).
 *
 * Módulo próprio do benefício, como a C2 Prev separa. O que o escritório
 * precisa ver num olhar: fato gerador (nascimento/adoção), categoria da
 * segurada, se a carência está resolvida e o desenho das 4 parcelas
 * (salário-maternidade é sempre 4 meses, nunca proporcional a dias).
 *
 * Dados de exemplo em memória. O módulo é leitura/organização — qualquer
 * peça (requerimento, inicial) sai pelo assistente e passa pela aprovação.
 */

type Categoria =
  | "EMPREGADA"
  | "CONTRIBUINTE_INDIVIDUAL"
  | "FACULTATIVA"
  | "SEGURADA_ESPECIAL"
  | "DESEMPREGADA"

type Caso = {
  id: string
  nome: string
  fato: string // nascimento/DPP ISO
  categoria: Categoria
  carenciaOk: boolean
  observacao: string
}

const CAT_LABEL: Record<Categoria, string> = {
  EMPREGADA: "Empregada",
  CONTRIBUINTE_INDIVIDUAL: "Contribuinte individual",
  FACULTATIVA: "Facultativa",
  SEGURADA_ESPECIAL: "Segurada especial (rural)",
  DESEMPREGADA: "Período de graça",
}

// Contribuinte individual, facultativa e segurada especial é que têm a
// discussão de carência (STF flexibilizou). Empregada não depende.
const CARENCIA_SE_APLICA: Record<Categoria, boolean> = {
  EMPREGADA: false,
  CONTRIBUINTE_INDIVIDUAL: true,
  FACULTATIVA: true,
  SEGURADA_ESPECIAL: true,
  DESEMPREGADA: true,
}

const SEED: Caso[] = [
  { id: "1", nome: "Antônia Ferreira Lima", fato: "2026-09-10", categoria: "CONTRIBUINTE_INDIVIDUAL", carenciaOk: false, observacao: "INSS negou por carência; tese do STF (dispensa) aplicável." },
  { id: "2", nome: "Juliana Prado Nunes", fato: "2026-08-22", categoria: "EMPREGADA", carenciaOk: true, observacao: "Vínculo antigo ainda aberto no CNIS — encerrar antes." },
  { id: "3", nome: "Rosângela Dias Moreira", fato: "2026-10-01", categoria: "SEGURADA_ESPECIAL", carenciaOk: true, observacao: "Autodeclaração rural + início de prova material." },
  { id: "4", nome: "Patrícia Gomes Teixeira", fato: "2026-07-15", categoria: "DESEMPREGADA", carenciaOk: true, observacao: "Mantém qualidade de segurada no período de graça." },
]

const SALARIO_MINIMO_2026 = 1621

function dataBr(iso: string) {
  return iso.slice(0, 10).split("-").reverse().join("/")
}

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function MaternidadePage() {
  const [filtro, setFiltro] = useState<"TODAS" | "PENDENTE_CARENCIA">("TODAS")

  const lista =
    filtro === "TODAS"
      ? SEED
      : SEED.filter((c) => CARENCIA_SE_APLICA[c.categoria] && !c.carenciaOk)

  return (
    <Pagina
      titulo="Salário-maternidade"
      subtitulo="Casos de maternidade por fato gerador, categoria e carência. Protótipo."
      voltar={{ href: "/inss", rotulo: "Administrativo" }}
    >
      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/50 px-4 py-3 text-[13px] text-muted-foreground">
        <Baby size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <p>
          Salário-maternidade é sempre <strong>4 salários mínimos</strong>{" "}
          ({moeda(SALARIO_MINIMO_2026)} em 2026 ={" "}
          <strong>{moeda(SALARIO_MINIMO_2026 * 4)}</strong>), nunca proporcional
          a dias. Carência só se discute para contribuinte individual,
          facultativa, segurada especial e período de graça — empregada não
          depende.
        </p>
      </div>

      <div className="flex justify-end">
        <Segmentado
          aria-label="Filtrar casos"
          valor={filtro}
          onChange={setFiltro}
          tamanho="sm"
          opcoes={[
            { valor: "TODAS", rotulo: "Todas" },
            { valor: "PENDENTE_CARENCIA", rotulo: "Carência a resolver" },
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[14px]">Casos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3 font-medium">Segurada</th>
                  <th className="py-2 pr-3 font-medium">Fato gerador</th>
                  <th className="py-2 pr-3 font-medium">Categoria</th>
                  <th className="py-2 pr-3 font-medium">Carência</th>
                  <th className="py-2 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const exige = CARENCIA_SE_APLICA[c.categoria]
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border/60 align-top last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-medium">{c.nome}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums text-muted-foreground">
                        {dataBr(c.fato)}
                      </td>
                      <td className="py-2.5 pr-3">{CAT_LABEL[c.categoria]}</td>
                      <td className="py-2.5 pr-3">
                        {!exige ? (
                          <Badge variant="muted">não exige</Badge>
                        ) : c.carenciaOk ? (
                          <Badge variant="success">
                            <CheckCircle2 /> ok
                          </Badge>
                        ) : (
                          <Badge variant="warning">
                            <AlertTriangle /> a resolver
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-[13px]">{c.observacao}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Pagina>
  )
}
