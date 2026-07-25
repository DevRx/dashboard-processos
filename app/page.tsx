import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ProcessTable, type ProcessoRecente } from "@/components/dashboard/process-table"
import { getSession } from "@/lib/session"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"

export default async function HomePage() {
  const session = await getSession()
  const user = await getCurrentUser()

  let processosAtivos = 0
  let totalClientes = 0
  let tarefasHoje = 0
  let processosRecentes: ProcessoRecente[] = []

  if (user) {
    const hoje = new Date().toISOString().slice(0, 10)

    const [processosCount, clientesCount, tarefasCount, processosRecentesRes] = await Promise.all([
      supabase
        .from("processos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("status", "in", "(CONCLUIDO,ARQUIVADO,RECUSADO)"),
      supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("tarefas")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("data", hoje),
      supabase
        .from("processos")
        .select("id, cliente_id, beneficio, status, data_entrada, cliente:clientes(nome)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ])

    processosAtivos = processosCount.count ?? 0
    totalClientes = clientesCount.count ?? 0
    tarefasHoje = tarefasCount.count ?? 0

    const camelRows = toCamelCase(processosRecentesRes.data) as unknown as Array<{
      id: string
      clienteId: string
      beneficio: string
      status: string
      dataEntrada: string | null
      cliente: { nome: string } | { nome: string }[] | null
    }>

    processosRecentes = (camelRows || []).map((p) => {
      const clienteNome = Array.isArray(p.cliente) ? p.cliente[0]?.nome : p.cliente?.nome
      return {
        id: p.id,
        clienteId: p.clienteId,
        clienteNome: clienteNome || "—",
        beneficio: p.beneficio,
        status: p.status as ProcessoRecente["status"],
        dataEntrada: p.dataEntrada,
      }
    })
  }

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
            <MetricCard title="Processos ativos" value={String(processosAtivos)} description="Em andamento" />
            <MetricCard title="Clientes" value={String(totalClientes)} description="Cadastrados" />
            <MetricCard title="Agenda" value={String(tarefasHoje)} description="Compromissos hoje" />
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Processos recentes</h2>
            <ProcessTable processos={processosRecentes} />
          </div>
        </main>
      </div>
    </div>
  )
}
