import "server-only"
import { supabase } from "@/lib/supabase/server"
import { consultarComunicacoesDjen } from "@/lib/integracoes/djen"
import { calcularPrazoFinal } from "@/lib/domain/prazo"
import { gerarTarefasDasIntimacoes } from "./gerar-tarefas"
import { analisarIntimacoes } from "./analisar"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Uma passada completa no DJEN: busca, guarda o que é novo e abre as
 * tarefas dos prazos.
 *
 * Vive fora da rota porque tem dois acionadores — o botão da tela e a
 * rotina agendada — e eles precisam fazer exatamente a mesma coisa.
 * Duas cópias divergem no primeiro ajuste, e a que roda de madrugada
 * é justamente a que ninguém vê divergir.
 */

/** Janela padrão da busca: o suficiente para não perder o que chegou. */
export const DIAS_PADRAO = 30

export type ResultadoSincronizacao =
  | {
      ok: true
      encontradas: number
      novas: number
      tarefasCriadas: number
      analisadas: number
      periodo: { dataInicio: string; dataFim: string }
    }
  | { ok: false; motivo: string }

function diasAtras(dias: number) {
  return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)
}

export async function sincronizarDjen(params: {
  userId: string
  numeroOab: string
  ufOab: string
  dataInicio?: string
  dataFim?: string
  criarTarefas?: boolean
  time?: string | null
  /** Triagem por IA antes de abrir as tarefas. Sem chave, é ignorada. */
  analisar?: boolean
}): Promise<ResultadoSincronizacao> {
  const dataInicio = params.dataInicio ?? diasAtras(DIAS_PADRAO)
  const dataFim = params.dataFim ?? new Date().toISOString().slice(0, 10)

  const resultado = await consultarComunicacoesDjen({
    numeroOab: params.numeroOab,
    ufOab: params.ufOab,
    dataInicio,
    dataFim,
  })

  if (!resultado.ok) return { ok: false, motivo: resultado.motivo }

  // Os números CNJ já cadastrados, para casar a intimação com o
  // processo sem uma consulta por item.
  const { data: processos } = await supabase
    .from("processos")
    .select("id, numero")
    .in("user_id", await idsDoEscritorio())
    .not("numero", "is", null)

  const porNumero = new Map(
    (processos ?? []).map((p) => [
      String(p.numero).replace(/\D/g, ""),
      p.id as string,
    ])
  )

  const { data: existentes } = await supabase
    .from("comunicacoes_djen")
    .select("djen_id")
    .in("user_id", await idsDoEscritorio())

  const jaTenho = new Set((existentes ?? []).map((e) => String(e.djen_id)))
  const novas = resultado.dados.filter((c) => !jaTenho.has(String(c.idDjen)))

  if (novas.length === 0) {
    return {
      ok: true,
      encontradas: resultado.dados.length,
      novas: 0,
      tarefasCriadas: 0,
      analisadas: 0,
      periodo: { dataInicio, dataFim },
    }
  }

  const linhas = novas.map((c) => ({
    user_id: params.userId,
    djen_id: c.idDjen,
    numero_processo: c.numeroProcesso,
    numero_processo_mascara: c.numeroProcessoMascara,
    sigla_tribunal: c.siglaTribunal,
    nome_orgao: c.nomeOrgao,
    tipo_comunicacao: c.tipoComunicacao,
    tipo_documento: c.tipoDocumento,
    nome_classe: c.nomeClasse,
    destinatario: c.destinatario,
    data_disponibilizacao: c.dataDisponibilizacao,
    texto: c.texto,
    link: c.link,
    prazo_dias: c.prazo?.dias ?? null,
    prazo_trecho: c.prazo?.trecho ?? null,
    prazo_estimado: c.prazo
      ? calcularPrazoFinal(c.dataDisponibilizacao, c.prazo.dias, c.siglaTribunal)
      : null,
    processo_id:
      porNumero.get((c.numeroProcesso ?? "").replace(/\D/g, "")) ?? null,
  }))

  const { data: gravadas, error } = await supabase
    .from("comunicacoes_djen")
    .insert(linhas)
    .select(
      "id, processo_id, tarefa_id, prazo_estimado, prazo_dias, tipo_documento, tipo_comunicacao, destinatario, numero_processo_mascara, sigla_tribunal, nome_orgao, link, texto"
    )

  if (error) {
    console.error("Gravar intimações:", error.message)
    return { ok: false, motivo: "gravacao_falhou" }
  }

  let tarefasCriadas = 0
  let analisadas = 0

  // A triagem vem antes da tarefa de propósito: é ela que diz se o
  // prazo do texto é do escritório, e isso muda o que a tarefa vira.
  if (params.analisar !== false && gravadas) {
    const triagem = await analisarIntimacoes(params.userId, gravadas)
    analisadas = triagem.analisadas
  }

  // O prazo já vem com data; deixar a tarefa para um clique seguinte é
  // onde o prazo se perde.
  if (params.criarTarefas !== false && gravadas) {
    // Relê do banco: as linhas em memória não têm a análise que
    // acabou de ser gravada, e é dela que sai o título da tarefa.
    const { data: comAnalise } = await supabase
      .from("comunicacoes_djen")
      .select(
        "id, processo_id, tarefa_id, prazo_estimado, prazo_dias, tipo_documento, tipo_comunicacao, destinatario, numero_processo_mascara, sigla_tribunal, nome_orgao, link, texto, ia_tipo_ato, ia_providencia, ia_urgencia, ia_prazo_de_quem"
      )
      .in("user_id", await idsDoEscritorio())
      .in("id", gravadas.map((g) => g.id))

    const geracao = await gerarTarefasDasIntimacoes(
      params.userId,
      comAnalise ?? gravadas,
      params.time
    )
    tarefasCriadas = geracao.criadas
  }

  return {
    ok: true,
    encontradas: resultado.dados.length,
    novas: novas.length,
    tarefasCriadas,
    analisadas,
    periodo: { dataInicio, dataFim },
  }
}
