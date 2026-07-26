import Link from "next/link"
import { ArrowRight, FolderSearch } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { type ProcessoStatus } from "@/lib/domain/processo"

export type ProcessoRecente = {
  id: string
  clienteId: string
  clienteNome: string
  beneficio: string
  status: ProcessoStatus
  dataEntrada: string | null
}

function formatarData(data: string | null) {
  if (!data) return "—"
  return data.slice(0, 10).split("-").reverse().join("/")
}

export function ProcessTable({ processos }: { processos: ProcessoRecente[] }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <h2 className="font-heading text-base leading-snug font-medium">
          Processos recentes
        </h2>
        <Link
          href="/processos"
          className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Cliente
              </TableHead>
              <TableHead className="px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Benefício
              </TableHead>
              <TableHead className="px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Status
              </TableHead>
              <TableHead className="px-4 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Entrada
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processos.map((processo) => (
              <TableRow key={processo.id}>
                <TableCell className="px-4 py-3">
                  <Link
                    href={`/clientes/${processo.clienteId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {processo.clienteNome}
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {processo.beneficio}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <StatusBadge status={processo.status} />
                </TableCell>
                <TableCell className="px-4 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {formatarData(processo.dataEntrada)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
