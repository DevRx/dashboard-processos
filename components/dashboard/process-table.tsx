import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getProcessoStatusLabel, type ProcessoStatus } from "@/lib/domain/processo"

export type ProcessoRecente = {
  id: string
  clienteId: string
  clienteNome: string
  beneficio: string
  status: ProcessoStatus
  dataEntrada: string | null
}

function getStatusVariant(status: string) {
  if (status === "CONCLUIDO" || status === "BENEFICIO_CONCEDIDO") return "default"
  if (status === "PERICIA_MARCADA" || status === "PERICIA_CONCLUIDA") return "secondary"
  if (status === "RECUSADO" || status === "ARQUIVADO") return "destructive"
  return "outline"
}

export function ProcessTable({ processos }: { processos: ProcessoRecente[] }) {
  if (processos.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-muted-foreground">Nenhum processo cadastrado ainda.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Benefício</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data de entrada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processos.map((processo) => (
            <TableRow key={processo.id}>
              <TableCell>
                <Link href={`/clientes/${processo.clienteId}`} className="font-medium hover:underline">
                  {processo.clienteNome}
                </Link>
              </TableCell>
              <TableCell>{processo.beneficio}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(processo.status)}>
                  {getProcessoStatusLabel(processo.status)}
                </Badge>
              </TableCell>
              <TableCell>
                {processo.dataEntrada
                  ? processo.dataEntrada.slice(0, 10).split("-").reverse().join("/")
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
