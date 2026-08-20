import "server-only"
import { supabase } from "@/lib/supabase/server"
import { analisarIntimacao } from "@/lib/ia/analista-intimacao"

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

    const { error } = await supabase
      .from("comunicacoes_djen")
      .update({
        ia_tipo_ato: analise.analise.tipoAto,
        ia_resumo: analise.analise.resumo,
        ia_providencia: analise.analise.providencia || null,
        ia_urgencia: analise.analise.urgencia,
        ia_prazo_de_quem: analise.analise.prazoDeQuem,
        ia_alertas: analise.analise.alertas ?? [],
        ia_modelo: analise.modelo,
        ia_analisada_em: new Date().toISOString(),
      })
      .eq("id", linha.id)
      .eq("user_id", userId)

    if (error) {
      console.error("Gravar análise:", error.message)
      resultado.falharam++
      continue
    }

    resultado.analisadas++
  }

  return resultado
}
