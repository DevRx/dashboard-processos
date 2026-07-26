import "server-only"
import type { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase/server"

/**
 * Registro de operações de tratamento (art. 37 da LGPD).
 *
 * Reaproveita a tabela `auditorias`, que já existia. O que este
 * módulo acrescenta é a garantia de que `detalhes` nunca carrega dado
 * pessoal: o registro precisa provar *que* houve tratamento, com que
 * base legal e por quem — não repetir o conteúdo tratado. Repetir o
 * conteúdo criaria uma segunda cópia do dado sensível fora do alcance
 * do expurgo.
 */

export type AcaoTratamento =
  | "IMPORTACAO_INSS"
  | "IMPORTACAO_RECUSADA"
  | "CONSULTA_DATAJUD"
  | "BASE_LEGAL_REGISTRADA"
  | "BASE_LEGAL_RETIFICADA"
  | "BASE_LEGAL_SUBSTITUIDA"
  | "BASE_LEGAL_REVOGADA"
  | "PORTABILIDADE_EXPORTADA"
  | "TITULAR_ELIMINADO"
  | "RETENCAO_EXPURGADA"

type RegistroTratamento = {
  userId: string
  acao: AcaoTratamento
  entidade: string
  entidadeId?: string | null
  /** Só metadados: fonte, base legal, contagens, motivo de recusa. */
  detalhes?: Record<string, string | number | boolean | null | undefined>
  ip?: string | null
}

/** IP do requisitante, considerando proxy do provedor de hospedagem. */
export function ipDaRequisicao(request: NextRequest): string | null {
  const encaminhado = request.headers.get("x-forwarded-for")
  if (encaminhado) return encaminhado.split(",")[0].trim()
  return request.headers.get("x-real-ip")
}

/**
 * Grava o registro. Falha de auditoria não derruba a operação de
 * negócio — mas é logada como erro, porque auditoria silenciosamente
 * quebrada é pior do que ausente: dá falsa sensação de conformidade.
 */
export async function registrarTratamento(
  registro: RegistroTratamento
): Promise<void> {
  const { error } = await supabase.from("auditorias").insert({
    user_id: registro.userId,
    acao: registro.acao,
    entidade: registro.entidade,
    entidade_id: registro.entidadeId ?? null,
    detalhes: registro.detalhes ?? null,
    ip: registro.ip ?? null,
  })

  if (error) {
    console.error("LGPD: falha ao registrar tratamento", {
      acao: registro.acao,
      erro: error.message,
    })
  }
}
