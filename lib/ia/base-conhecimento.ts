import "server-only"

/**
 * Base de conhecimento do agente do escritório.
 *
 * É o que o assistente sabe sobre COMO o escritório trabalha — não os
 * dados dos clientes (esses moram no banco). Comece pelo essencial e
 * vá acrescentando: é só editar este texto. Nada aqui é sensível nem
 * pessoal; são as regras de ofício do escritório.
 *
 * Regra ao editar: só prática profissional e padrão de trabalho.
 * Nunca ponha aqui senha, CPF, nome de cliente, telefone ou qualquer
 * dado de pessoa.
 */
export const BASE_CONHECIMENTO = `
# Estratégia das análises
- Padrão: judicializar. Administrativo negado → ação judicial, não recurso administrativo.
- Recurso administrativo só em caso simples, sem perícia médica.
- Antes de concluir uma análise: ler TODOS os documentos da pasta do cliente, inclusive laudos antigos e as fichas/relatos. Não presumir o benefício pelo indeferimento anterior.
- Em todo pedido negado, conferir se, na data daquele pedido, havia carência e qualidade de segurado (período de graça).

# Petição (padrão visual law — obrigatório)
- Títulos em negrito; trechos-chave em negrito com grifo amarelo.
- Didática e organizada: nada de blocão de texto; usar listas, itens numerados e marcadores.
- Sem linhas divisórias abaixo de títulos ou entre seções.
- Corpo justificado (esquerda e direita), salvo quando fica ruim visualmente.
- Citação transcrita com recuo em relação à margem.
- Fecho de toda peça: nome do advogado, OAB/DF 60.782 e a data de criação.
- Cabeçalho padrão: "[NOME DA PARTE], já qualificado(a) nos autos do processo em epígrafe, por meio de seu advogado que esta subscreve, vem, respeitosamente, à presença de Vossa Excelência, apresentar:" seguido do título centralizado, em caixa alta e negrito, e de "pelos fatos e fundamentos a seguir expostos."

# Impugnação a laudo pericial desfavorável
- Pedido PRINCIPAL: nova perícia (art. 480, CPC), sempre com a autorização/compromisso da parte de depositar os honorários da nova perícia.
- Pedido SUBSIDIÁRIO: devolução ao mesmo perito para esclarecimentos (art. 477, §2º). Nunca o contrário.

# Carta de concessão (quando o benefício sai)
- Documento em visual law próprio do escritório, com memória de cálculo.
- A data que vale é a previsão de pagamento do extrato (quando o dinheiro cai / vencimento do boleto), não a data de emissão.
- Honorários contratuais de 30% sobre o retroativo; o cliente recebe 70%.

# Acompanhamento no INSS
- Pela Central do INSS do sistema. O acesso que o escritório prefere é a procuração eletrônica (um login do advogado representa os clientes).
- O assistente não faz login por ninguém e não protocola sozinho: prepara e deixa para a aprovação do advogado.

# Tom com o cliente
- Quando a notícia é boa, avisar com carinho. Quando é ruim ou sensível, passa pela revisão do advogado antes.
`.trim()
