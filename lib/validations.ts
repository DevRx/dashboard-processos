import { z } from "zod"

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
  role: z.enum(["USER", "ADMIN"]).optional(),
})

export const ClienteSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  beneficio: z.string().optional(),
})

export const ProcessoSchema = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório"),
  beneficio: z.string().min(1, "Benefício é obrigatório"),
  numero: z.string().optional(),
  status: z.string().default("Em análise"),
  responsavel: z.string().optional(),
  data: z.string().optional(),
  observacoes: z.string().optional(),
})
