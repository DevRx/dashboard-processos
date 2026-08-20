// ─────────────────────────────────────────────────────────
// Domínio: espécies de benefício previdenciário
//
// Antes o benefício era texto livre, e texto livre em campo de
// classificação vira "Salario Maternidade", "salário maternidade" e
// "Sal. Maternidade" convivendo no mesmo banco — o que quebra qualquer
// contagem por tipo.
//
// A lista não é fechada de propósito: o GERID devolve o nome do
// serviço com a redação dele, e recusar esse valor faria a importação
// perder o dado. `isEspecieConhecida` existe para a interface poder
// exibir o valor recebido sem fingir que ele está no catálogo.
// ─────────────────────────────────────────────────────────

export const ESPECIES_BENEFICIO: readonly string[] = [
  "Aposentadoria por idade",
  "Aposentadoria por idade rural",
  "Aposentadoria por tempo de contribuição",
  "Aposentadoria especial",
  "Aposentadoria da pessoa com deficiência",
  "Aposentadoria por incapacidade permanente",
  "Auxílio por incapacidade temporária",
  "Auxílio-acidente",
  "Salário-maternidade",
  "Pensão por morte",
  "Auxílio-reclusão",
  "BPC/LOAS — idoso",
  "BPC/LOAS — pessoa com deficiência",
  "Revisão de benefício",
]

export function isEspecieConhecida(valor?: string | null): boolean {
  return Boolean(valor) && ESPECIES_BENEFICIO.includes(valor as string)
}

/**
 * Opções para um <select>, incluindo o valor atual quando ele não está
 * no catálogo. Sem isso, abrir um processo importado do GERID mostraria
 * o campo vazio e um "salvar" descuidado apagaria o benefício.
 */
export function opcoesEspecie(valorAtual?: string | null): string[] {
  if (valorAtual && !isEspecieConhecida(valorAtual)) {
    return [valorAtual, ...ESPECIES_BENEFICIO]
  }
  return [...ESPECIES_BENEFICIO]
}

export * from "./categorias"
