// ─────────────────────────────────────────────────────────
// TypeScript Types (aligned with prisma/schema.prisma)
// ─────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "ADVOGADO" | "ASSISTENTE" | "USER"

export type ProcessoStatus =
  | "EM_ANALISE"
  | "AGUARDANDO_INSS"
  | "PERICIA_MARCADA"
  | "PERICIA_CONCLUIDA"
  | "BENEFICIO_CONCEDIDO"
  | "RECUSADO"
  | "CONCLUIDO"
  | "ARQUIVADO"

export type TarefaStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA"

export type TarefaPrioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"

export type LancamentoTipo = "ENTRADA" | "SAIDA"

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
  numero?: string | null
  status: ProcessoStatus
  responsavelId?: string | null
  dataEntrada?: string | null
  dataConclusao?: string | null
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

export type LancamentoFinanceiro = {
  id: string
  userId: string
  descricao: string
  valor: number
  tipo: LancamentoTipo
  data: string
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

export const PROCESSO_STATUS_LABELS: Record<ProcessoStatus, string> = {
  EM_ANALISE: "Em análise",
  AGUARDANDO_INSS: "Aguardando INSS",
  PERICIA_MARCADA: "Perícia marcada",
  PERICIA_CONCLUIDA: "Perícia concluída",
  BENEFICIO_CONCEDIDO: "Benefício concedido",
  RECUSADO: "Recusado",
  CONCLUIDO: "Concluído",
  ARQUIVADO: "Arquivado",
}

export const PROCESSO_STATUS_VALUES = Object.keys(
  PROCESSO_STATUS_LABELS
) as ProcessoStatus[]

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

export const LANCAMENTO_TIPO_LABELS: Record<LancamentoTipo, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
}

export const LANCAMENTO_TIPO_VALUES = Object.keys(
  LANCAMENTO_TIPO_LABELS
) as LancamentoTipo[]
