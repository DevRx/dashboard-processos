import { AlertTriangle, CalendarCheck, FileText, Users } from "lucide-react"

import { Pagina } from "@/components/layout/pagina"
import { BoasVindas } from "@/components/dashboard/boas-vindas"
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
  let tarefasAtrasadas = 0
  let processosRecentes: ProcessoRecente[] = []
  const porStatus: Record<string, number> = {}
  let beneficiosAdministrativo: FatiaBeneficio[] = []
  let beneficiosJudicial: FatiaBeneficio[] = []

  if (user) {
    const hoje = new Date().toISOString().slice(0, 10)
    const escritorio = await idsDoEscritorio()

    const [
      processosCount,
      clientesCount,
      tarefasCount,
      atrasadasCount,
      processosRecentesRes,
      todosStatusRes,
      porBeneficioRes,
    ] = await Promise.all([
      supabase
        .from("processos")
        .select("*", { count: "exact", head: true })
        .in("user_id", escritorio)
        .not("status", "in", "(CONCLUIDO,ARQUIVADO,RECUSADO)"),
      supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .in("user_id", escritorio),
      supabase
        .from("tarefas")
        .select("*", { count: "exact", head: true })
        .in("user_id", escritorio)
        .eq("data", hoje),
      supabase
        .from("tarefas")
        .select("*", { count: "exact", head: true })
        .in("user_id", escritorio)
        .lt("data", hoje)
        .not("status", "in", "(CONCLUIDA,CANCELADA)"),
      supabase
        .from("processos")
        .select("id, cliente_id, beneficio, status, data_entrada, cliente:clientes(nome)")
        .in("user_id", escritorio)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("processos").select("status").in("user_id", escritorio),
      supabase
        .from("processos")
        .select("esfera, beneficio")
        .in("user_id", escritorio),
    ])

    processosAtivos = processosCount.count ?? 0
    totalClientes = clientesCount.count ?? 0
    tarefasHoje = tarefasCount.count ?? 0
    tarefasAtrasadas = atrasadasCount.count ?? 0

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
    <Pagina titulo="Início" subtitulo="Visão geral do escritório">
      <BoasVindas nome={session?.name ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={FileText}
          tom="info"
          title="Processos ativos"
          value={String(processosAtivos)}
          description="Em andamento no INSS ou na Justiça"
          href="/processos"
        />
        <MetricCard
          icon={Users}
          tom="neutro"
          title="Clientes"
          value={String(totalClientes)}
          description="Pessoas cadastradas"
          href="/clientes"
        />
        <MetricCard
          icon={CalendarCheck}
          tom="marca"
          title="Para hoje"
          value={String(tarefasHoje)}
          description={
            tarefasHoje === 1 ? "Compromisso ou prazo hoje" : "Compromissos e prazos hoje"
          }
          href="/agenda"
          rotuloLink="Abrir agenda"
        />
        <MetricCard
          icon={AlertTriangle}
          tom={tarefasAtrasadas > 0 ? "perigo" : "sucesso"}
          title="Atrasados"
          value={String(tarefasAtrasadas)}
          description={
            tarefasAtrasadas === 0
              ? "Nada passou do prazo"
              : tarefasAtrasadas === 1
                ? "Um item passou do prazo"
                : "Itens que passaram do prazo"
          }
          href="/agenda"
          rotuloLink="Resolver"
        />
      </div>

      <BeneficiosPorEsfera
        administrativo={beneficiosAdministrativo}
        judicial={beneficiosJudicial}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        <ProcessTable processos={processosRecentes} />
        <ProcessosStatusChart porStatus={porStatus} />
      </div>
    </Pagina>
  )
}
