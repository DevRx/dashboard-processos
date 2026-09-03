import Link from "next/link"
import { Scale, Users, FileText, ArrowUpRight } from "lucide-react"
import { supabase } from "@/lib/supabase/server"
import { PROCESSO_STATUS_LABELS, type ProcessoStatus } from "@/lib/data"

export const revalidate = 60

export const metadata = {
  title: "Resumo — Zeca Aposenta",
  robots: { index: false, follow: false },
}

async function getResumo() {
  const hoje = new Date().toISOString().slice(0, 10)
  const em7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [
    { count: totalClientes },
    { count: compromissosHoje },
    { count: compromissosSemana },
    { data: processos },
  ] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase.from("tarefas").select("*", { count: "exact", head: true }).eq("data", hoje),
    supabase
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .gte("data", hoje)
      .lte("data", em7dias),
    supabase.from("processos").select("status"),
  ])

  const porStatus: Record<string, number> = {}
  for (const p of processos || []) {
    porStatus[p.status] = (porStatus[p.status] || 0) + 1
  }

  const ativos = Object.entries(porStatus)
    .filter(([status]) => !["CONCLUIDO", "ARQUIVADO", "RECUSADO"].includes(status))
    .reduce((acc, [, n]) => acc + n, 0)

  return {
    totalClientes: totalClientes ?? 0,
    compromissosHoje: compromissosHoje ?? 0,
    compromissosSemana: compromissosSemana ?? 0,
    totalProcessos: processos?.length ?? 0,
    processosAtivos: ativos,
    porStatus,
  }
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}

export default async function ResumoEmbedPage() {
  const resumo = await getResumo()
  const atualizadoEm = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })

  return (
    <div className="min-h-screen bg-background p-5 text-foreground">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-brand shadow-glow">
          <Scale size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Zeca Aposenta</p>
          <p className="text-gradient-brand text-[10px] font-extrabold tracking-widest uppercase leading-tight">
            O Terror do INSS
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Processos ativos" value={resumo.processosAtivos} />
        <Metric label="Total de clientes" value={resumo.totalClientes} />
        <Metric label="Compromissos hoje" value={resumo.compromissosHoje} />
        <Metric label="Compromissos (7 dias)" value={resumo.compromissosSemana} />
      </div>

      {Object.keys(resumo.porStatus).length > 0 && (
        <div className="mt-4 rounded-2xl bg-card p-4 shadow-card">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Processos por status
          </p>
          <div className="flex flex-col gap-1.5">
            {Object.entries(resumo.porStatus).map(([status, n]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span>{PROCESSO_STATUS_LABELS[status as ProcessoStatus] || status}</span>
                <span className="font-semibold">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-card p-4 shadow-card">
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          Dados de clientes e processos são protegidos por login
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/clientes"
            target="_top"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-glow transition-colors hover:bg-primary-hover"
          >
            <Users size={14} />
            Ver clientes
            <ArrowUpRight size={12} />
          </Link>
          <Link
            href="/processos"
            target="_top"
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium hover:bg-background"
          >
            <FileText size={14} />
            Ver processos completos
            <ArrowUpRight size={12} />
          </Link>
          <Link
            href="/"
            target="_top"
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium hover:bg-background"
          >
            <Scale size={14} />
            Abrir sistema completo
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      <p className="mt-4 text-right text-[10px] text-muted-foreground">
        Atualizado em {atualizadoEm}
      </p>
    </div>
  )
}
