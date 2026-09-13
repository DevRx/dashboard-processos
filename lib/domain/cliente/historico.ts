/**
 * O histórico de comentários da ficha administrativa.
 *
 * Um comentário é um registro, não um campo: cada pessoa acrescenta o
 * seu, com nome e hora, e ninguém sobrescreve o que a outra escreveu.
 * O cliente guarda só os mais recentes — a ficha é lida de relance
 * antes de ligar para alguém, e o que importa é o que foi combinado
 * por último.
 */

/**
 * Quantos comentários ficam por cliente. O banco poda o resto por
 * trigger (ver supabase/migrations/20260913120000_historico_do_cliente.sql);
 * a API repete o número na leitura para nunca entregar mais do que
 * isso, mesmo num banco onde o trigger ainda não foi aplicado.
 */
export const LIMITE_HISTORICO = 3

/** Um comentário da equipe sobre o cliente: quem, quando, o quê. */
export type ComentarioCliente = {
  id: string
  texto: string
  criadoEm: string
  /**
   * Nulo quando o autor saiu do escritório, ou no comentário migrado
   * do campo antigo `observacoes`, que não guardava autor.
   */
  autor: { id: string; name: string } | null
}

/** A linha como o PostgREST a devolve, com o autor embutido. */
export type ComentarioBruto = {
  id: string
  texto: string
  created_at: string
  autor: { id: string; name: string } | { id: string; name: string }[] | null
}

/** Colunas pedidas ao PostgREST — o mesmo select nas duas rotas. */
export const SELECT_HISTORICO = "id, texto, created_at, autor:users(id, name)"

/**
 * O PostgREST devolve o embutido como objeto quando enxerga a chave
 * estrangeira como "muitos para um", e como lista quando não tem
 * certeza. Aqui é sempre um autor só; o desempate é só de tipo.
 */
export function comentarioDaLinha(linha: ComentarioBruto): ComentarioCliente {
  const autor = Array.isArray(linha.autor) ? (linha.autor[0] ?? null) : linha.autor
  return {
    id: linha.id,
    texto: linha.texto,
    criadoEm: linha.created_at,
    autor: autor ? { id: autor.id, name: autor.name } : null,
  }
}
