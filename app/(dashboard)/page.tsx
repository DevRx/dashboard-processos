import { AlarmClock, CalendarCheck, FileText, Users } from "lucide-react"

import { Pagina } from "@/components/layout/pagina"
import { BoasVindas } from "@/components/dashboard/boas-vindas"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ProcessTable, type ProcessoRecente } from "@/components/dashboard/process-table"
import { ProcessosStatusChart } from "@/components/charts/processos-status-chart"
import { BeneficiosPorEsfera } from "@/components/charts/beneficios-por-esfera"
import type { FatiaBeneficio } from "@/components/charts/beneficios-pizza"
import {
  UrgentesAtrasadas,
  type AtrasadasPorTime,
  type ItemUrgente,
} from "@/components/dashboard/urgentes-atrasadas"
import { AgendaDoDia, type ItemAgendaDoDia } from "@/components/dashboard/agenda-do-dia"
import {
  CATEGORIAS_AGENDA,
  TIMES_TAREFA,
  categoriaNaAgenda,
  isTimeTarefa,
} from "@/lib/domain/tarefa"
import { formatarDataLonga } from "@/lib/formatar"
import {
  CATEGORIAS_ADMINISTRATIVO,
  categorizarBeneficio,
} from "@/lib/domain/beneficio"
import { getSession } from "@/lib/session"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { idsDoEscritorio } from "@/lib/escritorio"

/** Hoje no fuso do escritório: o servidor roda em UTC e virava o dia às 21h. */
function hojeEmBrasilia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
}

type Junta<T> = T | T[] | null | undefined

function primeiro<T>(valor: Junta<T>): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : (valor ?? null)
}

const ZERADO = (): AtrasadasPorTime => ({ VERMELHO: 0, AZUL: 0, AMARELO: 0, ROSA: 0, SEM: 0 })

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
  let urgentes: ItemUrgente[] = []
  let totalUrgentes = 0
  const atrasadasPorTime = ZERADO()
  const hojePorTime = ZERADO()
  let agendaDeHoje: ItemAgendaDoDia[] = []
  const hoje = hojeEmBrasilia()

  if (user) {
    const escritorio = await idsDoEscritorio()
    const ABERTA = "(CONCLUIDA,CANCELADA)"

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
        .eq("data", hoje)
        .not("status", "in", ABERTA),
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

    // ── urgentes e atrasadas ─────────────────────────────────────
    // Uma contagem por time em vez de trazer as tarefas: atrasada
    // antiga do TickTick são centenas, e aqui só o número importa.
    const [atrasadasTimes, urgentesRes, urgentesCount, hojeRes] = await Promise.all([
      Promise.all(
        TIMES_TAREFA.map((time) =>
          supabase
            .from("tarefas")
            .select("*", { count: "exact", head: true })
            .in("user_id", escritorio)
            .lt("data", hoje)
            .not("status", "in", ABERTA)
            .eq("setor", time)
        )
      ),
      supabase
        .from("tarefas")
        .select("id, titulo, data, hora, setor, responsavel:users!tarefas_responsavel_id_fkey(name)")
        .in("user_id", escritorio)
        .eq("prioridade", "URGENTE")
        .not("status", "in", ABERTA)
        .order("data", { ascending: true })
        .order("id", { ascending: true })
        .limit(6),
      supabase
        .from("tarefas")
        .select("*", { count: "exact", head: true })
        .in("user_id", escritorio)
        .eq("prioridade", "URGENTE")
        .not("status", "in", ABERTA),
      supabase
        .from("tarefas")
        .select("id, titulo, hora, setor, pasta, tipo, responsavel:users!tarefas_responsavel_id_fkey(name)")
        .in("user_id", escritorio)
        .eq("data", hoje)
        .not("status", "in", ABERTA)
        .order("hora", { ascending: true, nullsFirst: false })
        .limit(1000),
    ])

    TIMES_TAREFA.forEach((time, i) => {
      atrasadasPorTime[time] = atrasadasTimes[i].count ?? 0
    })

    totalUrgentes = urgentesCount.count ?? 0
    urgentes = (urgentesRes.data ?? []).map((t) => ({
      id: String(t.id),
      titulo: t.titulo,
      data: String(t.data),
      hora: t.hora ?? null,
      setor: t.setor ?? null,
      responsavel: primeiro<{ name: string }>(t.responsavel)?.name ?? null,
    }))

    // ── agenda de hoje ───────────────────────────────────────────
    const deHoje = hojeRes.data ?? []
    for (const t of deHoje) {
      hojePorTime[isTimeTarefa(t.setor) ? t.setor : "SEM"]++
    }

    // Prazo do DJEN é a tarefa que uma intimação abriu; o vínculo
    // mora na intimação. Sem ele, a pasta e o título ainda decidem.
    const deIntimacao = new Set<string>()
    // Em lotes: centenas de ids numa consulta só estouram o tamanho
    // de endereço que o Supabase aceita.
    for (let i = 0; i < deHoje.length; i += 150) {
      const { data: vinculos } = await supabase
        .from("comunicacoes_djen")
        .select("tarefa_id")
        .in("tarefa_id", deHoje.slice(i, i + 150).map((t) => t.id))
      for (const v of vinculos ?? []) {
        if (v.tarefa_id) deIntimacao.add(String(v.tarefa_id))
      }
    }

    agendaDeHoje = deHoje
      .flatMap((t) => {
        const categoria = categoriaNaAgenda({
          titulo: t.titulo,
          pasta: t.pasta,
          tipo: t.tipo,
          deIntimacao: deIntimacao.has(String(t.id)),
        })
        return categoria
          ? [
              {
                id: String(t.id),
                titulo: t.titulo,
                hora: t.hora ?? null,
                categoria,
                responsavel: primeiro<{ name: string }>(t.responsavel)?.name ?? null,
              },
            ]
          : []
      })
      .sort(
        (a, b) =>
          (a.hora ?? "99").localeCompare(b.hora ?? "99") ||
          CATEGORIAS_AGENDA.indexOf(a.categoria) - CATEGORIAS_AGENDA.indexOf(b.categoria)
      )

    processosAtivos = processosCount.count ?? 0
    totalClientes = clientesCount.count ?? 0
    tarefasHoje = tarefasCount.count ?? 0
    tarefasAtrasadas = atrasadasCount.count ?? 0
    atrasadasPorTime.SEM = Math.max(
      0,
      tarefasAtrasadas - TIMES_TAREFA.reduce((soma, t) => soma + atrasadasPorTime[t], 0)
    )

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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          icon={FileText}
          tom="neutro"
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
          tom="neutro"
          title="Para hoje"
          value={String(tarefasHoje)}
          description={
            tarefasHoje === 1 ? "Compromisso ou prazo hoje" : "Compromissos e prazos hoje"
          }
          href="/agenda"
          rotuloLink="Abrir agenda"
        />
        <MetricCard
          icon={AlarmClock}
          tom={tarefasAtrasadas > 0 ? "atraso" : "sucesso"}
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

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <UrgentesAtrasadas
          urgentes={urgentes}
          totalUrgentes={totalUrgentes}
          atrasadas={atrasadasPorTime}
          totalAtrasadas={tarefasAtrasadas}
          hoje={hoje}
        />
        <AgendaDoDia
          dataPorExtenso={formatarDataLonga(hoje)}
          itens={agendaDeHoje}
          tarefasPorTime={hojePorTime}
          totalHoje={tarefasHoje}
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
