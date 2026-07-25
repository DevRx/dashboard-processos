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
