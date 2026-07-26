import { z } from "zod"

/**
 * Quais partes da proposta o operador confirmou.
 *
 * Cada campo é opt-in e default `false`: uma requisição malformada
 * aplica nada em vez de aplicar tudo. Documento do INSS chega com
 * erro, e o parser também — o padrão seguro é não mexer no processo.
 */
export const AplicarImportacaoSchema = z.object({
  processoId: z.string().uuid("Processo inválido"),
  status: z.boolean().default(false),
  prazo: z.boolean().default(false),
  andamento: z.boolean().default(false),
  tarefas: z.boolean().default(false),
  beneficio: z.boolean().default(false),
})

export type AplicarImportacaoInput = z.infer<typeof AplicarImportacaoSchema>
