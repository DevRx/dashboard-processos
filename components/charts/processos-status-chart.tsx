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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getProcessoStatusLabel, type ProcessoStatus } from "@/lib/domain/processo"

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
      label: getProcessoStatusLabel(status),
      total,
      cor: TOM_POR_STATUS[status as ProcessoStatus] || "var(--muted-foreground)",
    }))
    .sort((a, b) => b.total - a.total)

  const total = data.reduce((soma, item) => soma + item.total, 0)

  return (
    <Card className="gap-0">
      <CardHeader className="border-b pb-(--card-spacing)">
        <CardTitle>Processos por status</CardTitle>
        <CardDescription>
          {total === 1 ? "1 processo no total" : `${total} processos no total`}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-(--card-spacing)">
        {data.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum processo cadastrado ainda.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="var(--border)"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
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
