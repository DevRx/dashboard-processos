import "server-only"
import { supabase } from "@/lib/supabase/server"
import { analisarIntimacao } from "@/lib/ia/analista-intimacao"
import { idsDoEscritorio } from "@/lib/escritorio"
import { extrairEvento, isTipoEvento, mensagemPadraoAoCliente } from "@/lib/domain/intimacao"

/**
 * Analisa intimações e guarda o resultado.
 *
 * Compartilhado pelo botão do cartão, pelo lote da tela e pela rotina
 * agendada. O teto de itens por chamada existe porque a fila de um dia
 * ruim tem dezenas de publicações, e uma varredura de madrugada não
 * pode virar uma conta surpresa no fim do mês.
 */

export type LinhaParaAnalise = {
  id: string
  texto: string
  tipo_documento?: string | null
  nome_orgao?: string | null
  nome_classe?: string | null
}

export type ResultadoAnalises = {
  analisadas: number
  falharam: number
  semChave: boolean
}

export async function analisarIntimacoes(
  userId: string,
  linhas: LinhaParaAnalise[],
  limite = 30
): Promise<ResultadoAnalises> {
  const resultado: ResultadoAnalises = {
    analisadas: 0,
    falharam: 0,
    semChave: false,
  }

  for (const linha of linhas.slice(0, limite)) {
    const analise = await analisarIntimacao({
      texto: linha.texto,
      tipoDocumento: linha.tipo_documento,
      nomeOrgao: linha.nome_orgao,
      nomeClasse: linha.nome_classe,
    })

    if (!analise.ok) {
      // Sem chave não é falha de item: é configuração ausente, e
      // insistir nos outros só gastaria tempo repetindo o mesmo erro.
      if (analise.motivo === "sem_chave") {
        resultado.semChave = true
        break
      }

      resultado.falharam++
      continue
    }

    // O evento vem da IA, que lê com contexto; a regra entra onde a IA
    // não achou (ou achou sem lugar). Nunca se perde um dia marcado por
    // uma das leituras ter falhado.
    const evento = eventoDaIntimacao(linha.texto, analise.analise.evento)
    const mensagem =
      analise.analise.mensagemCliente?.trim() || (evento ? mensagemPadraoAoCliente(evento) : "")

    const { error } = await supabase
      .from("comunicacoes_djen")
      .update({
        ia_tipo_ato: analise.analise.tipoAto,
        ia_resumo: analise.analise.resumo,
        ia_providencia: analise.analise.providencia || null,
        ia_urgencia: analise.analise.urgencia,
        ia_prazo_de_quem: analise.analise.prazoDeQuem,
        ia_alertas: analise.analise.alertas ?? [],
        ia_evento_tipo: evento?.tipo ?? null,
        ia_evento_data: evento?.data ?? null,
        ia_evento_hora: evento?.hora ?? null,
        ia_evento_local: evento?.local ?? null,
        ia_mensagem_cliente: mensagem || null,
        ia_modelo: analise.modelo,
        ia_analisada_em: new Date().toISOString(),
      })
      .eq("id", linha.id)
      .in("user_id", await idsDoEscritorio())

    if (error) {
      console.error("Gravar análise:", error.message)
      resultado.falharam++
      continue
    }

    resultado.analisadas++
  }

  // O que a IA não leu (sem chave, falha, fora do teto) ainda passa
  // pela regra: um dia de perícia não pode depender de cota de IA.
  await gravarEventosPelaRegra(linhas)

  return resultado
}

type EventoLido = { tipo: "PERICIA" | "AUDIENCIA" | "OUTRO"; data: string; hora: string | null; local: string | null }

/**
 * Junta as duas leituras do evento: a da IA manda, a regra completa.
 * Quando só a regra achou, vale a regra. Quando nenhuma achou, não há
 * evento — e a tarefa de aviso não nasce.
 */
function eventoDaIntimacao(
  texto: string,
  daIa: { tipo: string; data: string; hora: string | null; local: string | null } | null | undefined
): EventoLido | null {
  const daRegra = extrairEvento(texto)
  if (daIa && isTipoEvento(daIa.tipo)) {
    return {
      tipo: daIa.tipo,
      data: daIa.data,
      hora: daIa.hora ?? daRegra?.hora ?? null,
      local: daIa.local ?? daRegra?.local ?? null,
    }
  }
  return daRegra ? { tipo: daRegra.tipo, data: daRegra.data, hora: daRegra.hora, local: daRegra.local } : null
}

/**
 * Sem chave de IA a triagem não roda — mas o evento da regra ainda
 * pode ser gravado, para a tarefa de aviso nascer mesmo assim.
 */
export async function gravarEventosPelaRegra(linhas: LinhaParaAnalise[]): Promise<number> {
  let gravados = 0
  for (const linha of linhas) {
    const evento = extrairEvento(linha.texto)
    if (!evento) continue
    const { error } = await supabase
      .from("comunicacoes_djen")
      .update({
        ia_evento_tipo: evento.tipo,
        ia_evento_data: evento.data,
        ia_evento_hora: evento.hora,
        ia_evento_local: evento.local,
        ia_mensagem_cliente: mensagemPadraoAoCliente(evento),
      })
      .eq("id", linha.id)
      .is("ia_evento_data", null)
      .in("user_id", await idsDoEscritorio())
    if (!error) gravados++
  }
  return gravados
}
