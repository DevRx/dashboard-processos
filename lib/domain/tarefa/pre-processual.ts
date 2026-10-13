// ─────────────────────────────────────────────────────────
// Domínio: tarefas pré-processuais
//
// Pré-processual é tudo o que acontece antes do protocolo: triagem,
// contrato, documentos, peça pronta esperando protocolar. É a fase de
// que todo o resto depende — por isso tem tela própria, separada por
// esfera, para cada um achar e acompanhar o que está nessa fase.
//
// As cores seguem a paleta dos times, sem inventar cor nova:
// administrativo em amarelo e judicial em vermelho — as mesmas do
// ADM 🌕 e do JUDICIAL 🔴 no TickTick.
//
// Não há campo "fase" no banco. A tarefa diz onde está pela pasta que
// veio do TickTick ("JUDICIAL › PROTOCOLO NOVO", "ADM › EXIGÊNCIAS"): a
// esfera sai do começo da pasta e a etapa, do resto. Mudar o que conta
// como pré-processual é mexer só nas listas abaixo.
// ─────────────────────────────────────────────────────────

import type { TimeTarefa } from "./time"

export const ESFERAS_PRE = ["ADMINISTRATIVO", "JUDICIAL"] as const

export type EsferaPre = (typeof ESFERAS_PRE)[number]

export const ESFERA_PRE_LABEL: Record<EsferaPre, string> = {
  ADMINISTRATIVO: "Administrativo",
  JUDICIAL: "Judicial",
}

/** A cor de cada esfera é a de um time — a paleta continua uma só. */
export const COR_DA_ESFERA: Record<EsferaPre, TimeTarefa> = {
  ADMINISTRATIVO: "AMARELO",
  JUDICIAL: "VERMELHO",
}

export const SLUG_DA_ESFERA: Record<EsferaPre, string> = {
  ADMINISTRATIVO: "administrativo",
  JUDICIAL: "judicial",
}

export function esferaPorSlug(slug?: string | null): EsferaPre | null {
  if (slug === "administrativo") return "ADMINISTRATIVO"
  if (slug === "judicial") return "JUDICIAL"
  return null
}

/** Sem acento, em caixa alta e sem pontuação solta. */
function normalizar(texto?: string | null) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[-_]/g, " ")
}

/**
 * Etapas que, sozinhas, já dizem "ainda não foi protocolado". Vêm antes
 * da lista de exclusão porque "TRIAGEM CLAUDE CONCLUIDA" fala em
 * concluída e continua sendo triagem.
 */
const ETAPA_PRE_CERTA = [
  /\bPROTOCOLO NOVO\b/,
  /\bA PROTOCOLAR\b/,
  /\bPROTOCOLAR\b/,
  /\bPRE ?PROCESSUA(L|IS)\b/,
  /\bTRIAGEM\b/,
]

/** Etapas de processo que já anda: não são pré-processuais. */
const ETAPA_POS = [
  /\bANDAMENTOS?\b/,
  /\bEXIGENCIAS?\b/,
  /\bPERICIAS?\b/,
  /\bLAUDOS?\b/,
  /\bSENTENCAS?\b/,
  /\bCONCESS(AO|OES)\b/,
  /\bRECURSOS?\b/,
  /\bACORDOS?\b/,
  /\bPRAZOS?\b/,
  /\bDATA B\b/,
  /\bIMPLANTA/,
  /\bRPV\b/,
  /\bAUDIENCIAS?\b/,
  /\bCUMPRIMENTO\b/,
  /\bARQUIVAD/,
]

/** Etapas típicas de antes do protocolo, quando nada acima decidiu. */
const ETAPA_PRE_PROVAVEL = [
  /\bANALISES?\b/,
  /\bCONTRATOS?\b/,
  /\bDOCUMENTOS?\b/,
  /\bDOCS?\b/,
  /\bPENDENCIAS?\b/,
  /\bPETICAO\b/,
  /\bINICIA(L|IS)\b/,
  /\bVIDEOCHAMADAS?\b/,
  /\bASSINATURAS?\b/,
  /\bPROCURACAO\b/,
]

/** "JUDICIAL › PROTOCOLO NOVO" → JUDICIAL; "ADM › …" → ADMINISTRATIVO. */
export function esferaDaPasta(pasta?: string | null): EsferaPre | null {
  const p = normalizar(pasta)
  if (/\bJUDICIA(L|IS)\b/.test(p)) return "JUDICIAL"
  if (/\bADM\b/.test(p) || /\bADMINISTRATIV/.test(p) || /\bINSS\b/.test(p)) return "ADMINISTRATIVO"
  return null
}

/**
 * A etapa é a pasta sem a parte que só diz a esfera:
 * "JUDICIAL › PROTOCOLO NOVO" → "PROTOCOLO NOVO".
 */
export function etapaDaPasta(pasta?: string | null): string {
  const partes = (pasta ?? "")
    .split("›")
    .map((p) => p.trim())
    .filter(Boolean)
  const resto = partes.filter((p) => !/^(ADM|ADMINISTRATIVO|JUDICIAL)$/i.test(normalizar(p).trim()))
  return resto.join(" › ") || "Sem etapa"
}

export type TarefaParaPreProcessual = {
  pasta?: string | null
  tipo?: string | null
}

/**
 * Em que esfera a tarefa está na fase pré-processual — ou `null`, se
 * ela não é dessa fase (ou se a pasta não diz a esfera).
 */
export function esferaPreProcessual(t: TarefaParaPreProcessual): EsferaPre | null {
  if (t.tipo === "DUVIDA") return null

  const esfera = esferaDaPasta(t.pasta)
  if (!esfera) return null

  const etapa = normalizar(etapaDaPasta(t.pasta))
  if (ETAPA_PRE_CERTA.some((r) => r.test(etapa))) return esfera
  if (ETAPA_POS.some((r) => r.test(etapa))) return null
  if (ETAPA_PRE_PROVAVEL.some((r) => r.test(etapa))) return esfera
  return null
}
