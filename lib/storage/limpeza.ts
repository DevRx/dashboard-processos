import "server-only"
import { supabase } from "@/lib/supabase/server"

/**
 * Remoção dos arquivos que o cascade do banco não alcança.
 *
 * Apagar um cliente derruba processos, documentos e consentimentos por
 * chave estrangeira — mas o storage é outro sistema, e ninguém avisa
 * ele. Sem isto, cada exclusão deixaria laudo médico e procuração
 * dentro do bucket, sem nenhuma linha apontando para eles: dado
 * pessoal invisível, fora do alcance do expurgo e da eliminação
 * pedida pelo titular.
 *
 * Falha aqui nunca aborta a exclusão — o registro já saiu do banco e
 * insistir deixaria o usuário travado. Mas é logada, porque arquivo
 * esquecido em silêncio é o pior dos dois mundos.
 */

async function remover(bucket: string, caminhos: string[]) {
  if (caminhos.length === 0) return
  const { error } = await supabase.storage.from(bucket).remove(caminhos)
  if (error) {
    console.error(`Limpeza de storage (${bucket}) falhou:`, error.message)
  }
}

/** Documentos anexados a um processo. */
export async function removerArquivosDoProcesso(
  processoId: string,
  userId: string
) {
  const { data } = await supabase
    .from("documentos")
    .select("caminho")
    .eq("processo_id", processoId)
    .eq("user_id", userId)
    .not("caminho", "is", null)

  await remover(
    "documentos",
    (data ?? []).map((d) => d.caminho as string).filter(Boolean)
  )
}

/** Documentos de todos os processos do cliente, mais as procurações. */
export async function removerArquivosDoCliente(
  clienteId: string,
  userId: string
) {
  const { data: processos } = await supabase
    .from("processos")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("user_id", userId)

  for (const processo of processos ?? []) {
    await removerArquivosDoProcesso(processo.id as string, userId)
  }

  const { data: consentimentos } = await supabase
    .from("consentimentos_lgpd")
    .select("procuracao_arquivo")
    .eq("cliente_id", clienteId)
    .eq("user_id", userId)
    .not("procuracao_arquivo", "is", null)

  await remover(
    "procuracoes",
    (consentimentos ?? [])
      .map((c) => c.procuracao_arquivo as string)
      .filter(Boolean)
  )
}
