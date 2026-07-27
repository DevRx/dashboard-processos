import { z } from "zod"
import { EsferaProcessoEnum, ProcessoStatusEnum } from "./enums"

/**
 * O padrão é `ADMINISTRATIVO` porque é onde o caso nasce: requerimento
 * no INSS, identificado por protocolo. Número CNJ, tribunal e vara só
 * passam a existir se houver ação judicial depois do indeferimento.
 */
export const ProcessoSchema = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório"),
  beneficio: z.string().min(1, "Benefício é obrigatório"),
  esfera: EsferaProcessoEnum.default("ADMINISTRATIVO"),
  numero: z.string().optional(),
  protocoloInss: z.string().optional(),
  numeroBeneficio: z.string().optional(),
  status: ProcessoStatusEnum.default("EM_ANALISE"),
  responsavelId: z.string().optional(),
  dataEntrada: z.string().optional(),
  dataConclusao: z.string().optional(),
  prazo: z.string().optional(),
  valorCausa: z.number().optional(),
  tribunal: z.string().optional(),
  vara: z.string().optional(),
  comarca: z.string().optional(),
  observacoes: z.string().optional(),
})

/**
 * Registro do protocolo depois de o requerimento ser apresentado no
 * GERID.
 *
 * Schema estreito de propósito: reaproveitar o `ProcessoSchema` num
 * PUT obrigaria a interface a reenviar o processo inteiro só para
 * anotar um número, e qualquer campo desatualizado na tela
 * sobrescreveria o que estava certo no banco.
 */
export const ProtocoloSchema = z.object({
  protocoloInss: z.string().min(3, "Informe o número do protocolo"),
  /** DER — data de entrada do requerimento. */
  dataEntrada: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional(),
})

export type ProtocoloInput = z.infer<typeof ProtocoloSchema>

