import { z } from "zod"

export const ClienteSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cpf: z.string().optional(),
  email: z.string().email("Digite um e-mail válido").optional(),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  dataNascimento: z.string().optional(),
  beneficio: z.string().optional(),
})
