import { z } from "zod"
import { LancamentoTipoEnum } from "./enums"

export const LancamentoFinanceiroSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valor: z.number().positive("Valor deve ser maior que zero"),
  tipo: LancamentoTipoEnum,
  data: z.string().min(1, "Data é obrigatória"),
})
