"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { MetricCard } from "@/components/dashboard/metric-card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Landmark, ShieldAlert, ShieldCheck, Inbox, Clock } from "lucide-react"

/**
 * Tela da integração INSS.
 *
 * A integração acontece por cliente, mas ninguém trabalha abrindo
 * cliente por cliente para ver se sobrou algo. Esta lista mostra o que
 * está pendente de ação — documento lido e não aplicado, base legal
 * faltando, retenção vencendo — e leva ao painel do cliente com um
 * clique.
 */

type ClienteIntegracao = {
  id: string
  nome: string
  baseLegal: string | null
  fontes: string[]
  retencaoAte: string | null
  retencaoVencida: boolean
  retencaoVencendo: boolean
  importadas: number
  pendentesAplicacao: number
  ultimaImportacao: string | null
}

type Resumo = {
  comBaseLegal: number
  semBaseLegal: number
  pendentesAplicacao: number
  retencaoEmRisco: number
}

const BASE_LEGAL_CURTO: Record<string, string> = {
  EXERCICIO_DIREITOS: "Procuração",
  CONSENTIMENTO: "Consentimento",
  OBRIGACAO_LEGAL: "Obrigação legal",
}

function formatarData(iso?: string | null) {
  if (!iso) return "—"
  return iso.slice(0, 10).split("-").reverse().join("/")
}

export default function InssPage() {
  const [clientes, setClientes] = useState<ClienteIntegracao[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(() => {
    return fetch("/api/integracoes/painel")
      .then((r) => (r.ok ? r.json() : { clientes: [], resumo: null }))
      .then((data) => {
        setClientes(data.clientes ?? [])
        setResumo(data.resumo ?? null)
      })
      .catch((err) => console.error("Erro ao carregar integração INSS:", err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Pendência primeiro: quem tem documento parado aparece no topo, e
  // depois quem ainda não tem base legal. Ordem alfabética resolve o
  // resto.
  const ordenados = [...clientes].sort((a, b) => {
    if (b.pendentesAplicacao !== a.pendentesAplicacao) {
      return b.pendentesAplicacao - a.pendentesAplicacao
    }
    if (Boolean(a.baseLegal) !== Boolean(b.baseLegal)) {
      return a.baseLegal ? 1 : -1
    }
    return a.nome.localeCompare(b.nome)
  })

  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header
          title="Integração INSS"
          subtitle="Meu INSS e GERID por importação assistida"
        />
        <main className="flex-1 space-y-6 p-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Aguardando aplicação"
                  value={String(resumo?.pendentesAplicacao ?? 0)}
                  description="Documentos lidos que ainda não entraram em nenhum processo"
                  icon={Inbox}
                />
                <MetricCard
                  title="Com base legal"
                  value={String(resumo?.comBaseLegal ?? 0)}
                  description="Clientes liberados para importar do INSS"
                  icon={ShieldCheck}
                />
                <MetricCard
                  title="Sem base legal"
                  value={String(resumo?.semBaseLegal ?? 0)}
                  description="Importação bloqueada até registrar procuração ou consentimento"
                  icon={ShieldAlert}
                />
                <MetricCard
                  title="Retenção em risco"
                  value={String(resumo?.retencaoEmRisco ?? 0)}
                  description="Prazo acordado com o titular vencido ou a vencer em 30 dias"
                  icon={Clock}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Clientes</CardTitle>
                </CardHeader>
                <CardContent>
                  {ordenados.length === 0 ? (
                    <EmptyState
                      icon={Landmark}
                      title="Nenhum cliente cadastrado"
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:text-zinc-500">
                            <th className="py-2 pr-3 font-medium">Cliente</th>
                            <th className="py-2 pr-3 font-medium">Base legal</th>
                            <th className="py-2 pr-3 font-medium">Documentos</th>
                            <th className="py-2 pr-3 font-medium">Retenção</th>
                            <th className="py-2 font-medium">Última importação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ordenados.map((c) => (
                            <tr
                              key={c.id}
                              className="border-b border-slate-100 last:border-0 dark:border-zinc-800/60"
                            >
                              <td className="py-2.5 pr-3">
                                <Link
                                  href={`/clientes/${c.id}`}
                                  className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                                >
                                  {c.nome}
                                </Link>
                              </td>
                              <td className="py-2.5 pr-3">
                                {c.baseLegal ? (
                                  <Badge variant="secondary">
                                    {BASE_LEGAL_CURTO[c.baseLegal] ?? c.baseLegal}
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">ausente</Badge>
                                )}
                              </td>
                              <td className="py-2.5 pr-3">
                                {c.importadas === 0 ? (
                                  <span className="text-slate-500 dark:text-zinc-500">
                                    —
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5">
                                    {c.importadas}
                                    {c.pendentesAplicacao > 0 && (
                                      <Badge variant="default">
                                        {c.pendentesAplicacao} a aplicar
                                      </Badge>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 pr-3">
                                {!c.retencaoAte ? (
                                  <span className="text-slate-500 dark:text-zinc-500">
                                    sem prazo
                                  </span>
                                ) : c.retencaoVencida ? (
                                  <Badge variant="destructive">
                                    vencida em {formatarData(c.retencaoAte)}
                                  </Badge>
                                ) : c.retencaoVencendo ? (
                                  <Badge variant="outline">
                                    vence {formatarData(c.retencaoAte)}
                                  </Badge>
                                ) : (
                                  formatarData(c.retencaoAte)
                                )}
                              </td>
                              <td className="py-2.5 text-slate-600 dark:text-zinc-400">
                                {formatarData(c.ultimaImportacao)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
