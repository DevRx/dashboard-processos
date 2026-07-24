import { Suspense } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { MetricCard } from "@/components/dashboard/metric-card"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

async function getDashboardData() {
  const clientes = await db.cliente.findMany()
  const processos = await db.processo.findMany()

  const totalProcessos = processos.length
  const processosEmAnalise = processos.filter(
    (p) => p.status === "Em análise" || p.status === "Aguardando INSS"
  ).length
  const periciasAgendadas = processos.filter(
    (p) => p.status.includes("Perícia")
  ).length
  const processosConcluidos = processos.filter(
    (p) => p.status === "Concluído" || p.status === "Benefício concedido"
  ).length

  const recentes = processos
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5)

  return {
    totalProcessos,
    processosEmAnalise,
    periciasAgendadas,
    processosConcluidos,
    recentes,
    clientes,
  }
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "Concluído" || status === "Benefício concedido"
      ? "default"
      : status.includes("Perícia")
        ? "secondary"
        : "outline"

  return (
    <Badge variant={variant} className="text-xs">
      {status}
    </Badge>
  )
}

export default async function Home() {
  await requireAuth()

  const data = await getDashboardData()

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />

        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">
              Visão Geral
            </h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe os processos do escritório
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Processos Ativos"
              value={String(data.totalProcessos)}
              description="Processos em andamento"
            />
            <MetricCard
              title="Aguardando INSS"
              value={String(data.processosEmAnalise)}
              description="Análises pendentes"
            />
            <MetricCard
              title="Perícias Agendadas"
              value={String(data.periciasAgendadas)}
              description="Próximos atendimentos"
            />
            <MetricCard
              title="Benefícios Concedidos"
              value={String(data.processosConcluidos)}
              description="Processos finalizados"
            />
          </div>

          <div className="mt-8 rounded-xl border bg-white p-6 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold">
              Últimos Processos
            </h2>

            {data.recentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum processo cadastrado ainda.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800">
                    <tr>
                      <th className="p-3 text-left">Cliente</th>
                      <th className="p-3 text-left">Benefício</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentes.map((processo) => {
                      const cliente = data.clientes.find(
                        (c) => c.id === processo.clienteId
                      )
                      return (
                        <tr key={processo.id} className="border-t">
                          <td className="p-3">
                            {cliente?.nome || "—"}
                          </td>
                          <td className="p-3">{processo.beneficio}</td>
                          <td className="p-3">
                            <StatusBadge status={processo.status} />
                          </td>
                          <td className="p-3">
                            {processo.responsavel || "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
