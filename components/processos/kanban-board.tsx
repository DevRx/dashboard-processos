"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, Clock } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { diasAte, formatarData, prazoRelativo } from "@/lib/formatar"
import { cn } from "@/lib/utils"
import { type Processo, type Cliente, type User } from "@/lib/data"

const SEM_BENEFICIO = "Sem benefício definido"

function prazoInfo(prazo?: string | null) {
  if (!prazo) return null
  const dias = diasAte(prazo)
  const label = `${formatarData(prazo)} · ${prazoRelativo(prazo)}`

  if (dias < 0) return { label, tom: "vencido" as const }
  if (dias <= 3) return { label, tom: "proximo" as const }
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

/**
 * Quadro de processos por benefício. Arrastar um cartão para outra
 * coluna troca o benefício do processo.
 */
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

  function getResponsavelNome(responsavelId?: string | null) {
    if (!responsavelId) return null
    return users.find((u) => u.id === responsavelId)?.name ?? null
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
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl p-3 ring-1 transition-colors",
              isDropTarget
                ? "bg-accent ring-primary/50"
                : "bg-muted/60 ring-foreground/5"
            )}
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
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <h3 className="font-heading truncate text-[13.5px] font-semibold" title={nomeColuna}>
                {nomeColuna}
              </h3>
              <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[11.5px] font-semibold tabular-nums ring-1 ring-foreground/10">
                {itens.length}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {itens.map((processo) => {
                const prazo = prazoInfo(processo.prazo)
                const responsavel = getResponsavelNome(processo.responsavelId)
                const nomeCliente = getClienteNome(processo.clienteId)

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
                    className={cn(
                      "cursor-grab rounded-lg bg-card p-3 shadow-xs ring-1 ring-foreground/10 transition-opacity active:cursor-grabbing",
                      (dragId === processo.id || movendo === processo.id) && "opacity-40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar nome={nomeCliente} tamanho="xs" />
                      <Link
                        href={`/clientes/${processo.clienteId}`}
                        className="min-w-0 flex-1 truncate text-[13px] font-medium hover:underline"
                      >
                        {nomeCliente}
                      </Link>
                      {responsavel && (
                        <Avatar nome={responsavel} tamanho="xs" className="ring-2 ring-card" />
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={processo.status} className="text-[10.5px]" />
                      {processo.numero && (
                        <span className="truncate font-mono text-[10.5px] text-muted-foreground">
                          {processo.numero}
                        </span>
                      )}
                    </div>

                    {prazo && (
                      <div
                        className={cn(
                          "mt-2 flex items-center gap-1 text-[11.5px]",
                          prazo.tom === "vencido" && "font-medium text-status-danger-foreground",
                          prazo.tom === "proximo" && "font-medium text-status-warning-foreground",
                          prazo.tom === "ok" && "text-muted-foreground"
                        )}
                      >
                        {prazo.tom === "ok" ? <Clock size={12} /> : <AlertTriangle size={12} />}
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
