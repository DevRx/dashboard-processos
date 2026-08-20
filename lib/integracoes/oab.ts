/**
 * OAB consultada no DJEN.
 *
 * A busca do diário é por inscrição, não por usuário do sistema, e o
 * escritório tem uma só. Fica em variável de ambiente para publicar em
 * outro escritório ser questão de configuração, com o valor de hoje
 * como padrão — a tela também aceita trocar a inscrição na hora da
 * busca, sem mexer em nada disto.
 */
export const OAB_PADRAO = {
  numero: process.env.DJEN_OAB_NUMERO ?? "60782",
  uf: process.env.DJEN_OAB_UF ?? "DF",
}
