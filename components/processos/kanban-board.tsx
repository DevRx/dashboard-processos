"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { type Processo, type Cliente, type User } from "@/lib/data"

const SEM_BENEFICIO = "Sem benefício definido"

function prazoInfo(prazo?: string | null) {
  if (!prazo) return null
  const hoje = new Date().toISOString().slice(0, 10)
  const dataPrazo = prazo.slice(0, 10)
  const diffDias = Math.round(
    (new Date(dataPrazo).getTime() - new Date(hoje).getTime()) / (1000 * 60 * 60 * 24)
  )
  const label = dataPrazo.split("-").reverse().join("/")

  if (diffDias < 0) return { label, tom: "vencido" as const }
  if (diffDias <= 3) return { label, tom: "proximo" as const }
  return { label, tom: "ok" as const }
}

function payloadFromProcesso(processo: Processo, overrides: Partial<Processo> = {}) {
  const p = { ...processo, ...overrides }
  return {
    clienteId: p.clienteId,
    beneficio: p.beneficio,
    numero: p.numero || undefined,
    status: p.status,
    responsavelId: p.responsavelId || undefined,
    dataEntrada: p.dataEntrada ? p.dataEntrada.slice(0, 10) : undefined,
    dataConclusao: p.dataConclusao ? p.dataConclusao.slice(0, 10) : undefined,
    prazo: p.prazo ? p.prazo.slice(0, 10) : undefined,
    valorCausa: p.valorCausa ?? undefined,
    tribunal: p.tribunal || undefined,
    vara: p.vara || undefined,
    comarca: p.comarca || undefined,
    observacoes: p.observacoes || undefined,
  }
}

export function KanbanBoard({
  processos,
  clientes,
  users,
  onUpdated,
}: {
  processos: Processo[]
  clientes: Cliente[]
  users: User[]
  onUpdated: () => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null)
  const [movendo, setMovendo] = useState<string | null>(null)

  function getClienteNome(clienteId: string) {
    return clientes.find((c) => c.id === clienteId)?.nome || "—"
  }

  function getResponsavelIniciais(responsavelId?: string | null) {
    if (!responsavelId) return null
    const nome = users.find((u) => u.id === responsavelId)?.name
    return nome ? nome.trim().slice(0, 1).toUpperCase() : null
  }

  const colunas = new Map<string, Processo[]>()
  for (const processo of processos) {
    const chave = processo.beneficio?.trim() || SEM_BENEFICIO
    if (!colunas.has(chave)) colunas.set(chave, [])
    colunas.get(chave)!.push(processo)
  }
  const nomesColunas = Array.from(colunas.keys()).sort((a, b) => {
    if (a === SEM_BENEFICIO) return 1
    if (b === SEM_BENEFICIO) return -1
    return a.localeCompare(b, "pt-BR")
  })

  async function moverProcesso(processo: Processo, novaColuna: string) {
    const novoBeneficio = novaColuna === SEM_BENEFICIO ? "" : novaColuna
    if (novoBeneficio === (processo.beneficio || "")) return

    setMovendo(processo.id)
    try {
      await fetch(`/api/processos/${processo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromProcesso(processo, { beneficio: novoBeneficio })),
      })
      onUpdated()
    } catch (err) {
      console.error("Erro ao mover processo:", err)
    } finally {
      setMovendo(null)
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {nomesColunas.map((nomeColuna) => {
        const itens = colunas.get(nomeColuna)!
        const isDropTarget = colunaAlvo === nomeColuna

        return (
          <div
            key={nomeColuna}
            className={`flex w-72 shrink-0 flex-col rounded-xl border p-3 transition-colors ${
              isDropTarget
                ? "border-pink-500 bg-pink-50 dark:border-pink-500 dark:bg-pink-950/20"
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setColunaAlvo(nomeColuna)
            }}
            onDragLeave={() => setColunaAlvo((c) => (c === nomeColuna ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              setColunaAlvo(null)
              const id = e.dataTransfer.getData("text/plain")
              const processo = processos.find((p) => p.id === id)
              if (processo) moverProcesso(processo, nomeColuna)
            }}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold">{nomeColuna}</h3>
              <Badge variant="outline">{itens.length}</Badge>
            </div>

            <div className="flex flex-col gap-2">
              {itens.map((processo) => {
                const prazo = prazoInfo(processo.prazo)
                const iniciais = getResponsavelIniciais(processo.responsavelId)

                return (
                  <div
                    key={processo.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(processo.id)
                      e.dataTransfer.setData("text/plain", processo.id)
                      e.dataTransfer.effectAllowed = "move"
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={`cursor-grab rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-opacity active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-900 ${
                      dragId === processo.id || movendo === processo.id ? "opacity-40" : ""
                    }`}
                  >
                    <Link
                      href={`/clientes/${processo.clienteId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {getClienteNome(processo.clienteId)}
                    </Link>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={processo.status} className="text-[10px]" />
                      {iniciais && (
                        <span
                          title={users.find((u) => u.id === processo.responsavelId)?.name}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600 text-[10px] font-bold text-white"
                        >
                          {iniciais}
                        </span>
                      )}
                    </div>

                    {prazo && (
                      <div
                        className={`mt-2 flex items-center gap-1 text-xs ${
                          prazo.tom === "vencido"
                            ? "text-red-600 dark:text-red-400"
                            : prazo.tom === "proximo"
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {prazo.tom === "ok" ? (
                          <Clock size={12} />
                        ) : (
                          <AlertTriangle size={12} />
                        )}
                        {prazo.label}
                      </div>
                    )}
                  </div>
                )
              })}

              {itens.length === 0 && (
                <p className="px-1 text-xs text-muted-foreground">Nenhum processo</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
