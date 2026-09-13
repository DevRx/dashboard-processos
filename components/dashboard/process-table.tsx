import Link from "next/link"
import { ArrowRight, ChevronRight, FolderSearch } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { type ProcessoStatus } from "@/lib/domain/processo"
import { formatarData } from "@/lib/formatar"

export type ProcessoRecente = {
  id: string
  clienteId: string
  clienteNome: string
  beneficio: string
  status: ProcessoStatus
  dataEntrada: string | null
}

/**
 * Os últimos processos, um por linha, com o cliente na frente.
 *
 * Virou lista de linhas clicáveis em vez de tabela: numa tabela a
 * pessoa precisa achar qual célula é o link; aqui a linha inteira leva
 * à ficha, e o avatar diz de quem se trata antes do nome.
 */
export function ProcessTable({ processos }: { processos: ProcessoRecente[] }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-heading text-[15px] leading-snug font-semibold">
            Processos recentes
          </h2>
          <p className="text-[12px] text-muted-foreground">Os últimos cadastrados</p>
        </div>
        <Link
          href="/processos"
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-accent dark:text-accent-foreground"
        >
          Ver todos
          <ArrowRight size={14} />
        </Link>
      </div>

      {processos.length === 0 ? (
        <EmptyState
          icon={FolderSearch}
          title="Nenhum processo cadastrado ainda"
          description="Os processos mais recentes aparecem aqui assim que forem criados."
        />
      ) : (
        <ul className="divide-y divide-border">
          {processos.map((processo) => (
            <li key={processo.id}>
              <Link
                href={`/clientes/${processo.clienteId}`}
                className="group flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                <Avatar nome={processo.clienteNome} tamanho="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    {processo.clienteNome}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {processo.beneficio || "Benefício não informado"}
                    {processo.dataEntrada && (
                      <>
                        {" · "}
                        <span className="font-mono tabular-nums">
                          {formatarData(processo.dataEntrada)}
                        </span>
                      </>
                    )}
                  </span>
                </span>
                <StatusBadge status={processo.status} className="hidden sm:inline-flex" />
                <ChevronRight
                  size={16}
                  className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
