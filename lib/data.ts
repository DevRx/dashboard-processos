// ─────────────────────────────────────────────────────────
// TypeScript Types (aligned with prisma/schema.prisma)
// ─────────────────────────────────────────────────────────

import type { ProcessoStatus } from "@/lib/domain/processo"

// O vocabulário de status do Processo vive em @/lib/domain/processo.
// Reexportado aqui para não quebrar os imports existentes.
export type { ProcessoStatus }

export type UserRole = "ADMIN" | "ADVOGADO" | "ASSISTENTE" | "USER"

export type TarefaStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA"

export type TarefaPrioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"


/** Fase do caso: requerimento no INSS ou ação judicial. */
export type EsferaProcesso = "ADMINISTRATIVO" | "JUDICIAL"

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  telefone?: string | null
  matricula?: string | null
  createdAt: string
  updatedAt: string
}

export type Cliente = {
  id: string
  userId: string
  nome: string
  cpf?: string | null
  email?: string | null
  telefone?: string | null
  endereco?: string | null
  dataNascimento?: string | null
  beneficio?: string | null
  createdAt: string
  updatedAt: string
  processos?: Processo[]
}

export type Processo = {
  id: string
  userId: string
  clienteId: string
  beneficio: string
  esfera?: EsferaProcesso
  /** Número único CNJ. Só existe na esfera judicial. */
  numero?: string | null
  /** Protocolo do requerimento no INSS, mostrado pelo GERID. */
  protocoloInss?: string | null
  /** NB, presente na carta de concessão e no extrato de pagamento. */
  numeroBeneficio?: string | null
  status: ProcessoStatus
  responsavelId?: string | null
  dataEntrada?: string | null
  dataConclusao?: string | null
  prazo?: string | null
  valorCausa?: number | null
  tribunal?: string | null
  vara?: string | null
  comarca?: string | null
  observacoes?: string | null
  createdAt: string
  updatedAt: string
}

export type Andamento = {
  id: string
  processoId: string
  userId: string
  data: string
  descricao: string
  status: ProcessoStatus
  createdAt: string
}

export type Tarefa = {
  id: string
  userId: string
  processoId?: string | null
  titulo: string
  descricao?: string | null
  data: string
  hora?: string | null
  status: TarefaStatus
  prioridade: TarefaPrioridade
  createdAt: string
  updatedAt: string
}

export type Documento = {
  id: string
  processoId: string
  userId: string
  nome: string
  url: string
  tipo?: string | null
  tamanho?: number | null
  createdAt: string
}

export type Auditoria = {
  id: string
  userId: string
  acao: string
  entidade: string
  entidadeId?: string | null
  detalhes?: Record<string, unknown> | null
  ip?: string | null
  createdAt: string
}

// ─────────────────────────────────────────────────────────
// Status Display Helpers
// ─────────────────────────────────────────────────────────

// Rótulos e ordem oficial do Processo vivem em @/lib/domain/processo.
// Reexportados aqui para não quebrar os imports existentes.
export {
  PROCESSO_STATUS_LABELS,
  PROCESSO_STATUS_VALUES,
} from "@/lib/domain/processo"

export const TAREFA_STATUS_LABELS: Record<TarefaStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
}

export const TAREFA_STATUS_VALUES = Object.keys(
  TAREFA_STATUS_LABELS
) as TarefaStatus[]

export const TAREFA_PRIORIDADE_LABELS: Record<TarefaPrioridade, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
}

export const TAREFA_PRIORIDADE_VALUES = Object.keys(
  TAREFA_PRIORIDADE_LABELS
) as TarefaPrioridade[]

