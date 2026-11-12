/**
 * Cadastro aberto, por ora.
 *
 * Com `true`, qualquer pessoa cria a própria conta em /register, sem
 * ADMIN logado — decisão do escritório para pôr a equipe para dentro
 * de uma vez. A conta nasce sempre como USER, mas enxerga a carteira
 * inteira (CPF, laudo, consentimento): enquanto isto estiver ligado,
 * quem tiver o endereço do sistema entra.
 *
 * Para fechar de novo, troque para `false`: o proxy volta a exigir
 * sessão em /register, a rota volta a exigir ADMIN e o login deixa de
 * oferecer "Criar acesso". Nada mais precisa mudar.
 */
export const CADASTRO_ABERTO = true
