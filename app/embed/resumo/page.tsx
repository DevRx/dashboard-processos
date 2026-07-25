import { Scale } from "lucide-react"
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
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
    <div className="min-h-screen bg-zinc-50 p-5 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 via-pink-600 to-red-600">
          <Scale size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Zeca Aposenta</p>
          <p className="bg-gradient-to-r from-fuchsia-500 via-pink-600 to-red-600 bg-clip-text text-[10px] font-extrabold tracking-widest text-transparent uppercase leading-tight">
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
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
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

      <p className="mt-4 text-right text-[10px] text-zinc-400">
        Atualizado em {atualizadoEm}
      </p>
    </div>
  )
}
