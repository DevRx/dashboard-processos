import "server-only"
import { supabase } from "@/lib/supabase/server"
import { idsDoEscritorio } from "@/lib/escritorio"

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

/**
 * Arquivos ligados **apenas** a este processo.
 *
 * Documento do cliente que por acaso está vinculado ao caso não é
 * removido: excluir o caso desfaz o vínculo (`on delete set null`) e o
 * arquivo permanece na pasta do titular. Apagá-lo aqui destruiria um
 * RG que vale para todos os outros casos.
 */
export async function removerArquivosDoProcesso(
  processoId: string
) {
  const { data } = await supabase
    .from("documentos")
    .select("caminho")
    .eq("processo_id", processoId)
    .in("user_id", await idsDoEscritorio())
    .is("cliente_id", null)
    .not("caminho", "is", null)

  await remover(
    "documentos",
    (data ?? []).map((d) => d.caminho as string).filter(Boolean)
  )
}

/** Toda a pasta do cliente, mais as procurações da base legal. */
export async function removerArquivosDoCliente(
  clienteId: string
) {
  const { data: documentos } = await supabase
    .from("documentos")
    .select("caminho")
    .eq("cliente_id", clienteId)
    .in("user_id", await idsDoEscritorio())
    .not("caminho", "is", null)

  await remover(
    "documentos",
    (documentos ?? []).map((d) => d.caminho as string).filter(Boolean)
  )

  const { data: consentimentos } = await supabase
    .from("consentimentos_lgpd")
    .select("procuracao_arquivo")
    .eq("cliente_id", clienteId)
    .in("user_id", await idsDoEscritorio())
    .not("procuracao_arquivo", "is", null)

  await remover(
    "procuracoes",
    (consentimentos ?? [])
      .map((c) => c.procuracao_arquivo as string)
      .filter(Boolean)
  )
}
