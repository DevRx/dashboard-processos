import "server-only"
import { supabase } from "@/lib/supabase/server"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Eliminação por término da retenção (art. 15, I e art. 16).
 *
 * Guardar dado sensível "por segurança" depois que a finalidade
 * acabou é infração, não cautela. Este módulo apaga o conteúdo
 * importado e preserva apenas a casca do registro — id, fonte, datas,
 * hash — porque o registro de tratamento (art. 37) precisa sobreviver
 * ao dado tratado. É o inverso do reflexo comum: apaga-se o miolo,
 * mantém-se a prova de que existiu e de que foi eliminado.
 */

export type ResultadoExpurgo = {
  expurgadas: number
  erro?: string
}

/**
 * Expurga importações cujo `expurgar_em` já passou.
 *
 * Idempotente: linhas já expurgadas ficam fora do filtro, então
 * chamar duas vezes no mesmo dia não conta duplicado. Pensado para
 * rodar num cron diário.
 */
export async function expurgarImportacoesVencidas(
  userId?: string
): Promise<ResultadoExpurgo> {
  const hoje = new Date().toISOString().slice(0, 10)

  let consulta = supabase
    .from("importacoes_integracao")
    .update({
      dados: { expurgado: true },
      expurgado_em: new Date().toISOString(),
    })
    .lt("expurgar_em", hoje)
    .is("expurgado_em", null)

  if (userId) {
    consulta = consulta.in("user_id", await idsDoEscritorio())
  }

  const { data, error } = await consulta.select("id")

  if (error) {
    console.error("LGPD: falha no expurgo de retenção", error.message)
    return { expurgadas: 0, erro: error.message }
  }

  return { expurgadas: data?.length ?? 0 }
}

/**
 * Eliminação a pedido do titular (art. 18, VI), restrita ao que a
 * integração trouxe.
 *
 * Não apaga o cliente nem os processos: o escritório tem dever de
 * guarda de documentos do mandato e prazo prescricional, o que é
 * exatamente a exceção do art. 16, I. Apagar o processo inteiro
 * "atendendo ao titular" prejudicaria o próprio titular no caso de
 * revisão. O que se elimina é a cópia de dado do INSS que o
 * dashboard mantinha por conveniência.
 */
export async function eliminarDadosImportados(
  clienteId: string
): Promise<ResultadoExpurgo> {
  const { data, error } = await supabase
    .from("importacoes_integracao")
    .update({
      dados: { eliminado_a_pedido_do_titular: true },
      expurgado_em: new Date().toISOString(),
    })
    .eq("cliente_id", clienteId)
    .in("user_id", await idsDoEscritorio())
    .is("expurgado_em", null)
    .select("id")

  if (error) {
    console.error("LGPD: falha na eliminação a pedido do titular", error.message)
    return { expurgadas: 0, erro: error.message }
  }

  return { expurgadas: data?.length ?? 0 }
}
