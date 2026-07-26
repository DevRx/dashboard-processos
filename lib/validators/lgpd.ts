import { z } from "zod"
import { BaseLegalLGPDEnum, FonteIntegracaoEnum } from "./enums"

/**
 * Registro de base legal para tratar dado previdenciário sensível.
 *
 * `finalidade` é obrigatória e com mínimo real de caracteres porque
 * finalidade genérica ("uso interno") não satisfaz o art. 6º, I —
 * ela precisa ser específica e informada ao titular. Um campo que
 * aceitasse uma palavra viraria caixa de "ok" e a conformidade seria
 * fictícia.
 */
export const ConsentimentoSchema = z
  .object({
    clienteId: z.string().uuid("Cliente inválido"),
    baseLegal: BaseLegalLGPDEnum,
    finalidade: z
      .string()
      .min(15, "Descreva a finalidade específica do tratamento"),
    procuracaoRef: z.string().optional(),
    fontes: z
      .array(FonteIntegracaoEnum)
      .min(1, "Selecione ao menos uma fonte autorizada"),
    /** Fim do prazo de retenção acordado, "AAAA-MM-DD". */
    retencaoAte: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
      .optional(),
  })
  .refine(
    (dados) =>
      dados.baseLegal !== "EXERCICIO_DIREITOS" || Boolean(dados.procuracaoRef),
    {
      // Sem identificar a procuração, "exercício regular de direitos"
      // é afirmação sem lastro: numa fiscalização não há o que exibir.
      message: "Informe a procuração que fundamenta o exercício de direitos",
      path: ["procuracaoRef"],
    }
  )

export type ConsentimentoInput = z.infer<typeof ConsentimentoSchema>

export const RevogacaoSchema = z.object({
  motivo: z.string().min(3, "Informe o motivo da revogação"),
})
