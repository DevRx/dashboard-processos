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
