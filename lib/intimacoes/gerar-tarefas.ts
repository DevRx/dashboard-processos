import "server-only"
import { supabase } from "@/lib/supabase/server"
import {
  descricaoDaTarefa,
  prioridadePorPrazo,
  tituloDaTarefa,
  type IntimacaoParaTarefa,
} from "@/lib/domain/intimacao"

/**
 * Transforma prazos de intimação em tarefas do quadro.
 *
 * Usado pela busca no DJEN (que já cria tudo o que chegou) e pelo
 * mutirão dos pendentes. Nunca cria duas para a mesma intimação: a
 * checagem é o `tarefa_id` da própria linha, e o vínculo é gravado
 * logo depois da inserção.
 */

type Linha = IntimacaoParaTarefa & {
  id: string
  processo_id: string | null
  tarefa_id: string | null
  prazo_estimado: string | null
}

export type ResultadoGeracao = {
  criadas: number
  jaTinham: number
  semPrazo: number
}

export async function gerarTarefasDasIntimacoes(
  userId: string,
  intimacoes: Linha[],
  /** Time que recebe as tarefas automáticas. Sem ele, caem na faixa
   *  "sem time", que funciona como caixa de entrada do quadro. */
  time?: string | null
): Promise<ResultadoGeracao> {
  const resultado: ResultadoGeracao = { criadas: 0, jaTinham: 0, semPrazo: 0 }

  for (const intimacao of intimacoes) {
    if (intimacao.tarefa_id) {
      resultado.jaTinham++
      continue
    }

    if (!intimacao.prazo_estimado) {
      resultado.semPrazo++
      continue
    }

    const { data: tarefa, error } = await supabase
      .from("tarefas")
      .insert({
        user_id: userId,
        processo_id: intimacao.processo_id,
        titulo: tituloDaTarefa(intimacao),
        descricao: descricaoDaTarefa(intimacao),
        data: intimacao.prazo_estimado,
        status: "PENDENTE",
        // A intimação vai junto: prazo de outra parte não urge.
        prioridade: prioridadePorPrazo(
          intimacao.prazo_estimado,
          undefined,
          intimacao
        ),
        setor: time ?? null,
      })
      .select("id")
      .single()

    if (error || !tarefa) {
      console.error("Criar tarefa da intimação:", error?.message)
      continue
    }

    const { error: erroVinculo } = await supabase
      .from("comunicacoes_djen")
      .update({ tarefa_id: tarefa.id })
      .eq("id", intimacao.id)
      .eq("user_id", userId)

    // Sem o vínculo, a próxima busca criaria a tarefa de novo. Melhor
    // apagar a recém-criada do que deixar o quadro duplicar sozinho.
    if (erroVinculo) {
      console.error("Vincular tarefa à intimação:", erroVinculo.message)
      await supabase.from("tarefas").delete().eq("id", tarefa.id)
      continue
    }

    resultado.criadas++
  }

  return resultado
}
