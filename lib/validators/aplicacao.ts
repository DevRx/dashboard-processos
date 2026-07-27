import { z } from "zod"

/**
 * Quais partes da proposta o operador confirmou.
 *
 * Cada campo é opt-in e default `false`: uma requisição malformada
 * aplica nada em vez de aplicar tudo. Documento do INSS chega com
 * erro, e o parser também — o padrão seguro é não mexer no processo.
 *
 * `processoId` ausente com `criarRequerimento` significa abrir um
 * requerimento administrativo a partir do próprio documento. É o caso
 * comum: o cliente chega sem nada cadastrado e o requerimento no INSS
 * é justamente o primeiro fato do caso — obrigar a criar um "processo"
 * antes, num formulário que pede número CNJ, exigiria inventar um dado
 * que a fase administrativa não tem.
 */
export const AplicarImportacaoSchema = z
  .object({
    processoId: z.string().uuid("Processo inválido").optional(),
    criarRequerimento: z.boolean().default(false),
    status: z.boolean().default(false),
    prazo: z.boolean().default(false),
    andamento: z.boolean().default(false),
    tarefas: z.boolean().default(false),
    beneficio: z.boolean().default(false),
    identificadores: z.boolean().default(false),
  })
  .refine((d) => Boolean(d.processoId) !== d.criarRequerimento, {
    message:
      "Escolha um processo de destino ou peça para criar o requerimento — não os dois",
    path: ["processoId"],
  })

export type AplicarImportacaoInput = z.infer<typeof AplicarImportacaoSchema>
