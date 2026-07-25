"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PROCESSO_STATUS_LABELS, type ProcessoStatus } from "@/lib/data"

const TOM_POR_STATUS: Record<ProcessoStatus, string> = {
  EM_ANALISE: "var(--status-info-foreground)",
  AGUARDANDO_INSS: "var(--status-info-foreground)",
  PERICIA_MARCADA: "var(--status-info-foreground)",
  PERICIA_CONCLUIDA: "var(--status-info-foreground)",
  BENEFICIO_CONCEDIDO: "var(--status-success-foreground)",
  CONCLUIDO: "var(--status-success-foreground)",
  RECUSADO: "var(--status-danger-foreground)",
  ARQUIVADO: "var(--status-muted-foreground)",
}

export function ProcessosStatusChart({
  porStatus,
}: {
  porStatus: Record<string, number>
}) {
  const data = Object.entries(porStatus)
    .map(([status, total]) => ({
      status,
      label: PROCESSO_STATUS_LABELS[status as ProcessoStatus] || status,
      total,
      cor: TOM_POR_STATUS[status as ProcessoStatus] || "var(--muted-foreground)",
    }))
    .sort((a, b) => b.total - a.total)

  return (
    <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <CardHeader>
        <CardTitle className="text-base">Processos por status</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum processo cadastrado ainda.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {data.map((entry) => (
                    <Cell key={entry.status} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
