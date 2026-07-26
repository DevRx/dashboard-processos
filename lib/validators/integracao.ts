import { z } from "zod"
import { DocumentoINSSEnum, FonteIntegracaoEnum } from "./enums"

/**
 * Importação assistida de documento do INSS.
 *
 * `texto` tem teto de 200 KB: um CNIS longo colado em texto fica na
 * casa de dezenas de KB, e o limite impede que um PDF inteiro
 * despejado por engano trave o parser em regex.
 */
export const ImportacaoSchema = z.object({
  clienteId: z.string().uuid("Cliente inválido"),
  processoId: z.string().uuid("Processo inválido").optional(),
  fonte: FonteIntegracaoEnum.exclude(["DATAJUD"], {
    message: "O DataJud é consultado automaticamente, não importado",
  }),
  /** Opcional: quando ausente, o tipo é detectado pelo conteúdo. */
  documento: DocumentoINSSEnum.optional(),
  texto: z
    .string()
    .min(20, "Cole o conteúdo do documento oficial")
    .max(200_000, "Documento muito grande — cole apenas a parte relevante"),
})

export type ImportacaoInput = z.infer<typeof ImportacaoSchema>
