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

export const FonteIntegracaoEnum = z.enum(["DATAJUD", "MEU_INSS", "GERID"])

export const BaseLegalLGPDEnum = z.enum([
  "CONSENTIMENTO",
  "OBRIGACAO_LEGAL",
  "EXERCICIO_DIREITOS",
])

export const DocumentoINSSEnum = z.enum([
  "CNIS",
  "CARTA_CONCESSAO",
  "CARTA_INDEFERIMENTO",
  "EXTRATO_PAGAMENTO",
  "REQUERIMENTO_GERID",
])
