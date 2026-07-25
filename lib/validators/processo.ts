import { z } from "zod"
import { ProcessoStatusEnum } from "./enums"

export const ProcessoSchema = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório"),
  beneficio: z.string().min(1, "Benefício é obrigatório"),
  numero: z.string().optional(),
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
