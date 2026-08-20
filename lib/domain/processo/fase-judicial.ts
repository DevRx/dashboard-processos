import { PROCESSO_STATUS_VALUES, type ProcessoStatus } from "./status"

// ─────────────────────────────────────────────────────────
// Domínio: fases da ação judicial
//
// O `ProcessoStatus` nasceu descrevendo o requerimento administrativo,
// e é o mesmo enum dos dois lados — trocá-lo mexeria em todas as
// telas. O que muda no judicial é a leitura: "Aguardando INSS" ali
// quer dizer protocolada e aguardando o juízo, e "Benefício
// concedido" quer dizer sentença procedente.
//
// Esta camada é só de tradução e agrupamento. Nada aqui é gravado: o
// banco continua guardando o status de sempre.
// ─────────────────────────────────────────────────────────

export const FASES_JUDICIAIS = [
  "TRIAGEM",
  "PROTOCOLADA",
  "PERICIA",
  "SENTENCA",
  "ENCERRADA",
] as const

export type FaseJudicial = (typeof FASES_JUDICIAIS)[number]

export const FASE_LABEL: Record<FaseJudicial, string> = {
  TRIAGEM: "Triagem",
  PROTOCOLADA: "Protocolada",
  PERICIA: "Perícia",
  SENTENCA: "Sentença",
  ENCERRADA: "Encerrada",
}

export const FASE_DESCRICAO: Record<FaseJudicial, string> = {
  TRIAGEM: "Antes da distribuição — documentos e viabilidade",
  PROTOCOLADA: "Distribuída, aguardando movimentação do juízo",
  PERICIA: "Perícia médica judicial marcada ou realizada",
  SENTENCA: "Julgada em primeiro grau",
  ENCERRADA: "Sem trabalho pendente",
}

const STATUS_DA_FASE: Record<FaseJudicial, ProcessoStatus[]> = {
  TRIAGEM: ["EM_ANALISE"],
  PROTOCOLADA: ["AGUARDANDO_INSS"],
  PERICIA: ["PERICIA_MARCADA", "PERICIA_CONCLUIDA"],
  SENTENCA: ["BENEFICIO_CONCEDIDO", "RECUSADO"],
  ENCERRADA: ["CONCLUIDO", "ARQUIVADO"],
}

/** Rótulo do status lido pela ótica judicial. */
export const STATUS_LABEL_JUDICIAL: Record<ProcessoStatus, string> = {
  EM_ANALISE: "Em triagem",
  AGUARDANDO_INSS: "Aguardando o juízo",
  PERICIA_MARCADA: "Perícia marcada",
  PERICIA_CONCLUIDA: "Perícia realizada",
  BENEFICIO_CONCEDIDO: "Procedente",
  RECUSADO: "Improcedente",
  CONCLUIDO: "Concluída",
  ARQUIVADO: "Arquivada",
}

export function faseDoStatus(status: string): FaseJudicial {
  for (const fase of FASES_JUDICIAIS) {
    if (STATUS_DA_FASE[fase].includes(status as ProcessoStatus)) return fase
  }
  return "TRIAGEM"
}

export function statusDaFase(fase: FaseJudicial): ProcessoStatus[] {
  return STATUS_DA_FASE[fase]
}

/** Ordem judicial dos status, para o menu de troca de fase. */
export const STATUS_JUDICIAIS: readonly ProcessoStatus[] = FASES_JUDICIAIS.flatMap(
  (f) => STATUS_DA_FASE[f]
)

/** Guarda contra um status novo no enum ficar fora de toda fase. */
export const STATUS_SEM_FASE = PROCESSO_STATUS_VALUES.filter(
  (s) => !STATUS_JUDICIAIS.includes(s)
)
