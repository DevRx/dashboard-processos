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
  /**
   * Ambos opcionais: o normal é o conteúdo do documento revelar de que
   * sistema ele veio e qual documento é. Só valem como desempate,
   * quando a deteccão automática não reconhece o texto colado — pedir
   * a fonte de antemão é fazer o operador decidir o que a máquina
   * decide melhor.
   */
  fonte: FonteIntegracaoEnum.exclude(["DATAJUD"], {
    message: "O DataJud é consultado automaticamente, não importado",
  }).optional(),
  documento: DocumentoINSSEnum.optional(),
  texto: z
    .string()
    .min(20, "Cole o conteúdo do documento oficial")
    .max(200_000, "Documento muito grande — cole apenas a parte relevante"),
})

export type ImportacaoInput = z.infer<typeof ImportacaoSchema>
