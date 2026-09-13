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

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase()
}

export function ProcessTable({ processos }: { processos: ProcessoRecente[] }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-card">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="font-heading text-[15px] leading-snug font-semibold tracking-[-0.01em]">
            Processos recentes
          </h2>
          <p className="text-[12.5px] text-muted-foreground">
            Os últimos cadastrados no escritório
          </p>
        </div>
        <Link
          href="/processos"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-[12.5px] font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
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
              <TableHead className="px-5">Cliente</TableHead>
              <TableHead className="px-5">Benefício</TableHead>
              <TableHead className="px-5">Status</TableHead>
              <TableHead className="px-5 text-right">Entrada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processos.map((processo) => (
              <TableRow key={processo.id}>
                <TableCell className="px-5 py-3">
                  <Link
                    href={`/clientes/${processo.clienteId}`}
                    className="group inline-flex items-center gap-2.5 font-medium"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10.5px] font-bold text-accent-foreground">
                      {iniciais(processo.clienteNome)}
                    </span>
                    <span className="underline-offset-4 group-hover:underline">
                      {processo.clienteNome}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="px-5 py-3 text-muted-foreground">
                  {processo.beneficio}
                </TableCell>
                <TableCell className="px-5 py-3">
                  <StatusBadge status={processo.status} />
                </TableCell>
                <TableCell className="px-5 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
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
