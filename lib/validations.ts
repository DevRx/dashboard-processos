import { z } from "zod"

// ─────────────────────────────────────────────────────────
// Enums (must match prisma/schema.prisma)
// ─────────────────────────────────────────────────────────

export const UserRoleEnum = z.enum(["ADMIN", "ADVOGADO", "ASSISTENTE", "USER"])

export const ProcessoStatusEnum = z.enum([
  "EM_ANALISE",
  "AGUARDANDO_INSS",
  "PERICIA_MARCADA",
  "PERICIA_CONCLUIDA",
  "BENEFICIO_CONCEDIDO",
  "RECUSADO",
  "CONCLUIDO",
  "ARQUIVADO",
])

export const TarefaStatusEnum = z.enum([
  "PENDENTE",
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
])

export const TarefaPrioridadeEnum = z.enum([
  "BAIXA",
  "MEDIA",
  "ALTA",
  "URGENTE",
])

export const LancamentoTipoEnum = z.enum(["ENTRADA", "SAIDA"])

// ─────────────────────────────────────────────────────────
// Auth Schemas
// ─────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email("Digite um e-mail válido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
})

export const RegisterSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Digite um e-mail válido"),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres"),
  role: UserRoleEnum.optional(),
  telefone: z.string().optional(),
  matricula: z.string().optional(),
})

// ─────────────────────────────────────────────────────────
// Cliente Schema
// ─────────────────────────────────────────────────────────

export const ClienteSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cpf: z.string().optional(),
  email: z.string().email("Digite um e-mail válido").optional(),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  dataNascimento: z.string().optional(),
  beneficio: z.string().optional(),
})

// ─────────────────────────────────────────────────────────
// Processo Schema
// ─────────────────────────────────────────────────────────

export const ProcessoSchema = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório"),
  beneficio: z.string().min(1, "Benefício é obrigatório"),
  numero: z.string().optional(),
  status: ProcessoStatusEnum.default("EM_ANALISE"),
  responsavelId: z.string().optional(),
  dataEntrada: z.string().optional(),
  dataConclusao: z.string().optional(),
  valorCausa: z.number().optional(),
  tribunal: z.string().optional(),
  vara: z.string().optional(),
  comarca: z.string().optional(),
  observacoes: z.string().optional(),
})

// ─────────────────────────────────────────────────────────
// Andamento Schema
// ─────────────────────────────────────────────────────────

export const AndamentoSchema = z.object({
  processoId: z.string().min(1, "Processo é obrigatório"),
  data: z.string().min(1, "Data é obrigatória"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  status: ProcessoStatusEnum,
})

// ─────────────────────────────────────────────────────────
// Tarefa Schema
// ─────────────────────────────────────────────────────────

export const TarefaSchema = z.object({
  processoId: z.string().optional(),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  data: z.string().min(1, "Data é obrigatória"),
  hora: z.string().optional(),
  status: TarefaStatusEnum.default("PENDENTE"),
  prioridade: TarefaPrioridadeEnum.default("MEDIA"),
})

// ─────────────────────────────────────────────────────────
// Lançamento Financeiro Schema
// ─────────────────────────────────────────────────────────

export const LancamentoFinanceiroSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valor: z.number().positive("Valor deve ser maior que zero"),
  tipo: LancamentoTipoEnum,
  data: z.string().min(1, "Data é obrigatória"),
})

// ─────────────────────────────────────────────────────────
// Documento Schema
// ─────────────────────────────────────────────────────────

export const DocumentoSchema = z.object({
  processoId: z.string().min(1, "Processo é obrigatório"),
  nome: z.string().min(1, "Nome é obrigatório"),
  url: z.string().min(1, "URL é obrigatório"),
  tipo: z.string().optional(),
  tamanho: z.number().optional(),
})
