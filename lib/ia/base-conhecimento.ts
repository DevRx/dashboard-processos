import "server-only"

/**
 * Base de conhecimento do agente — ofício previdenciário.
 *
 * Este sistema vai ser multi-tenant (vários escritórios, vários
 * usuários). Então aqui entra só o que é CRAFT da advocacia
 * previdenciária e serve a qualquer escritório: como se produz uma
 * peça e o que se confere numa análise.
 *
 * NÃO entra, nunca:
 *  - dado de pessoa (cliente, equipe): nome, CPF, senha, telefone;
 *  - nada pessoal do dono do escritório (lazer, brindes, hobbies);
 *  - os conectores e a infraestrutura (TickTick, WhatsApp, Drive, etc.);
 *  - o processo operacional "por trás" — como as tarefas fluem, quem
 *    faz o quê, as automações, o passo a passo interno do escritório.
 *
 * E com cautela: padrões e craft, sim; o passo a passo proprietário
 * completo, não. Identificadores de um escritório específico (número
 * de OAB, nome, cidade) ficam de fora — cada tenant tem o seu.
 */
export const BASE_CONHECIMENTO = `
# Análise do caso (a entrega, não o passo a passo interno)
A análise sai no mesmo capricho de uma peça — organizada, direta, fácil de ler — e cobre:
- o benefício pretendido e um retrato da situação do segurado;
- se os requisitos estão atendidos, com atenção a qualidade de segurado e carência no período relevante;
- o caminho recomendado (administrativo ou judicial) e a razão — caso que depende de perícia médica, em regra, tende ao judicial;
- o que ainda falta para instruir o pedido.

# Produção de peça — padrão "visual law"
- Didática e visualmente organizada: nada de blocão de texto; usar listas, itens numerados e marcadores.
- Títulos em negrito; trechos-chave em negrito com grifo amarelo.
- Sem linhas divisórias abaixo de títulos ou entre seções.
- Corpo justificado (esquerda e direita), salvo quando fica ruim visualmente.
- Citação de lei, súmula ou jurisprudência transcrita com recuo em relação à margem.
- Cabeçalho padrão: "[NOME DA PARTE], já qualificado(a) nos autos do processo em epígrafe, por meio de seu advogado que esta subscreve, vem, respeitosamente, à presença de Vossa Excelência, apresentar:" seguido do título da peça centralizado, em caixa alta e negrito, e de "pelos fatos e fundamentos a seguir expostos."
- Fecho de toda peça: nome do advogado, número da OAB e data de criação.

# Tese recorrente — impugnação a laudo pericial desfavorável
- Pedido PRINCIPAL: nova perícia (art. 480, CPC), sempre acompanhado da autorização/compromisso da parte de depositar os honorários da nova perícia.
- Pedido SUBSIDIÁRIO: devolução ao mesmo perito para esclarecimentos (art. 477, §2º, CPC). Nunca inverter a ordem.

# Carta de concessão / memória de cálculo
- Documento em visual law explicando ao cliente o que foi concedido e o que ele vai receber.
- A data que vale é a previsão de pagamento do extrato (quando o crédito cai), não a data de emissão do documento.
- Honorários conforme o contrato daquele escritório; o cálculo separa a parte do cliente da parte dos honorários sobre o retroativo.
`.trim()
