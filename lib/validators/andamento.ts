import { z } from "zod"
import { ProcessoStatusEnum } from "./enums"

export const AndamentoSchema = z.object({
  processoId: z.string().min(1, "Processo é obrigatório"),
  data: z.string().min(1, "Data é obrigatória"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  status: ProcessoStatusEnum,
})
