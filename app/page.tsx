import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { MetricCard } from "@/components/dashboard/metric-card"
import { getSession } from "@/lib/session"

export default async function HomePage() {
  const session = await getSession()

  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />

        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Visão Geral</h1>
            <p className="text-sm text-muted-foreground">
              {session ? `Bem-vindo, ${session.name}` : "Faça login para acessar o sistema."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard title="Processos ativos" value="12" description="Em andamento" />
            <MetricCard title="Clientes" value="28" description="Cadastrados" />
            <MetricCard title="Agenda" value="5" description="Compromissos hoje" />
          </div>

          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Resumo rápido</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Acompanhe os principais números do escritório em um só lugar.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
