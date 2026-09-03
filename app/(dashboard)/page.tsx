import { CalendarDays, FileText, Users } from "lucide-react"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ProcessTable, type ProcessoRecente } from "@/components/dashboard/process-table"
import { ProcessosStatusChart } from "@/components/charts/processos-status-chart"
import { BeneficiosPorEsfera } from "@/components/charts/beneficios-por-esfera"
import type { FatiaBeneficio } from "@/components/charts/beneficios-pizza"
import {
  CATEGORIAS_ADMINISTRATIVO,
  categorizarBeneficio,
} from "@/lib/domain/beneficio"
import { getSession } from "@/lib/session"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { idsDoEscritorio } from "@/lib/escritorio"

export default async function HomePage() {
  const session = await getSession()
  const user = await getCurrentUser()

  let processosAtivos = 0
  let totalClientes = 0
  let tarefasHoje = 0
  let processosRecentes: ProcessoRecente[] = []
  const porStatus: Record<string, number> = {}
  let beneficiosAdministrativo: FatiaBeneficio[] = []
  let beneficiosJudicial: FatiaBeneficio[] = []

  if (user) {
    const hoje = new Date().toISOString().slice(0, 10)

    const [
      processosCount,
      clientesCount,
      tarefasCount,
      processosRecentesRes,
      todosStatusRes,
      porBeneficioRes,
    ] = await Promise.all([
      supabase
        .from("processos")
        .select("*", { count: "exact", head: true })
        .in("user_id", await idsDoEscritorio())
        .not("status", "in", "(CONCLUIDO,ARQUIVADO,RECUSADO)"),
      supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .in("user_id", await idsDoEscritorio()),
      supabase
        .from("tarefas")
        .select("*", { count: "exact", head: true })
        .in("user_id", await idsDoEscritorio())
        .eq("data", hoje),
      supabase
        .from("processos")
        .select("id, cliente_id, beneficio, status, data_entrada, cliente:clientes(nome)")
        .in("user_id", await idsDoEscritorio())
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("processos").select("status").in("user_id", await idsDoEscritorio()),
      supabase
        .from("processos")
        .select("esfera, beneficio")
        .in("user_id", await idsDoEscritorio()),
    ])

    processosAtivos = processosCount.count ?? 0
    totalClientes = clientesCount.count ?? 0
    tarefasHoje = tarefasCount.count ?? 0

    for (const p of todosStatusRes.data || []) {
      porStatus[p.status] = (porStatus[p.status] || 0) + 1
    }

    // `beneficio` é texto livre — o GERID devolve a redação dele —, então
    // a fatia sai da mesma classificação que o quadro Administrativo usa,
    // e não de um `group by` no banco.
    const contagem = {
      ADMINISTRATIVO: new Map<string, number>(),
      JUDICIAL: new Map<string, number>(),
    }

    for (const p of porBeneficioRes.data || []) {
      const esfera = p.esfera === "JUDICIAL" ? "JUDICIAL" : "ADMINISTRATIVO"
      const categoria = categorizarBeneficio(p.beneficio)
      const mapa = contagem[esfera]
      mapa.set(categoria, (mapa.get(categoria) ?? 0) + 1)
    }

    // A ordem é a do catálogo, não a da contagem: assim a mesma família
    // fica na mesma posição nas duas pizzas.
    const fatias = (mapa: Map<string, number>): FatiaBeneficio[] =>
      CATEGORIAS_ADMINISTRATIVO.map((categoria) => ({
        categoria,
        total: mapa.get(categoria) ?? 0,
      })).filter((f) => f.total > 0)

    beneficiosAdministrativo = fatias(contagem.ADMINISTRATIVO)
    beneficiosJudicial = fatias(contagem.JUDICIAL)

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
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header
          title="Visão geral"
          subtitle={
            session
              ? `Bem-vindo, ${session.name}`
              : "Faça login para acessar o sistema."
          }
        />

        <main className="flex-1 space-y-6 p-5 md:p-7">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              icon={FileText}
              title="Processos ativos"
              value={String(processosAtivos)}
              description="Em andamento"
            />
            <MetricCard
              icon={Users}
              tom="brand"
              title="Clientes"
              value={String(totalClientes)}
              description="Cadastrados"
            />
            <MetricCard
              icon={CalendarDays}
              tom="success"
              title="Agenda"
              value={String(tarefasHoje)}
              description="Compromissos hoje"
            />
          </div>

          <BeneficiosPorEsfera
            administrativo={beneficiosAdministrativo}
            judicial={beneficiosJudicial}
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
            <ProcessTable processos={processosRecentes} />
            <ProcessosStatusChart porStatus={porStatus} />
          </div>
        </main>
      </div>
    </div>
  )
}
