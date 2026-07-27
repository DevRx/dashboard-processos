import { z } from "zod"
import { BaseLegalLGPDEnum, FonteIntegracaoEnum } from "./enums"

/**
 * Campos da base legal para tratar dado previdenciário sensível.
 *
 * `finalidade` é obrigatória e com mínimo real de caracteres porque
 * finalidade genérica ("uso interno") não satisfaz o art. 6º, I —
 * ela precisa ser específica e informada ao titular. Um campo que
 * aceitasse uma palavra viraria caixa de "ok" e a conformidade seria
 * fictícia.
 */
const camposBaseLegal = {
  baseLegal: BaseLegalLGPDEnum,
  finalidade: z
    .string()
    .min(15, "Descreva a finalidade específica do tratamento"),
  procuracaoRef: z.string().optional(),
  fontes: z
    .array(FonteIntegracaoEnum)
    .min(1, "Selecione ao menos uma fonte autorizada"),
  /**
   * Desligada por padrão: mandar documento do titular para leitura por
   * IA é transferência internacional a um operador novo, e quem não
   * marcar continua usando o sistema inteiro sem isso.
   */
  iaAutorizada: z.boolean().default(false),
  /** Fim do prazo de retenção acordado, "AAAA-MM-DD". */
  retencaoAte: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional(),
}

/**
 * Sem identificar a procuração, "exercício regular de direitos" é
 * afirmação sem lastro: numa fiscalização não há o que exibir.
 */
const exigeProcuracao = {
  validar: (dados: { baseLegal: string; procuracaoRef?: string }) =>
    dados.baseLegal !== "EXERCICIO_DIREITOS" || Boolean(dados.procuracaoRef),
  erro: {
    message: "Informe a procuração que fundamenta o exercício de direitos",
    path: ["procuracaoRef"],
  },
}

export const ConsentimentoSchema = z
  .object({ clienteId: z.string().uuid("Cliente inválido"), ...camposBaseLegal })
  .refine(exigeProcuracao.validar, exigeProcuracao.erro)

export type ConsentimentoInput = z.infer<typeof ConsentimentoSchema>

/**
 * Retificação da base legal vigente.
 *
 * Não aceita `clienteId`: o titular de uma base legal não muda. Trocar
 * o titular de um registro de tratamento existente apagaria a
 * correspondência entre o que foi tratado e de quem era o dado.
 */
export const ConsentimentoEdicaoSchema = z
  .object(camposBaseLegal)
  .refine(exigeProcuracao.validar, exigeProcuracao.erro)

export type ConsentimentoEdicaoInput = z.infer<typeof ConsentimentoEdicaoSchema>

export const RevogacaoSchema = z.object({
  motivo: z.string().min(3, "Informe o motivo da revogação"),
})
