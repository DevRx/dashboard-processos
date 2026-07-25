import { z } from "zod"

export const DocumentoSchema = z.object({
  processoId: z.string().min(1, "Processo é obrigatório"),
  nome: z.string().min(1, "Nome é obrigatório"),
  url: z.string().min(1, "URL é obrigatório"),
  tipo: z.string().optional(),
  tamanho: z.number().optional(),
})
