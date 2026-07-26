import "server-only"
import type {
  AdapterImportacao,
  DocumentoINSS,
  FonteIntegracao,
} from "@/lib/integracoes/contrato"
import { adaptersMeuInss } from "@/lib/integracoes/meu-inss"
import { adapterGerid } from "@/lib/integracoes/gerid"

export * from "@/lib/integracoes/contrato"

/**
 * Registro dos adapters de importação assistida.
 *
 * A ordem importa: `CARTA_INDEFERIMENTO` reconhece qualquer texto com
 * "indeferi", o que também aparece em espelho do GERID. Por isso o
 * adapter do GERID vem primeiro — ele é mais específico (exige a
 * marca do sistema no texto).
 */
const ADAPTERS: AdapterImportacao<unknown>[] = [adapterGerid, ...adaptersMeuInss]

export const DOCUMENTO_LABELS: Record<DocumentoINSS, string> = {
  CNIS: "Extrato CNIS",
  CARTA_CONCESSAO: "Carta de concessão",
  CARTA_INDEFERIMENTO: "Comunicado de decisão / indeferimento",
  EXTRATO_PAGAMENTO: "Extrato de pagamento",
  REQUERIMENTO_GERID: "Requerimento GERID",
}

export const FONTE_LABELS: Record<FonteIntegracao, string> = {
  DATAJUD: "DataJud (CNJ)",
  MEU_INSS: "Meu INSS",
  GERID: "INSS Digital / GERID",
}

/**
 * Escolhe o adapter. Se `documento` foi informado pelo operador, ele
 * manda — a detecção automática só decide quando ninguém decidiu.
 */
export function selecionarAdapter(params: {
  fonte: FonteIntegracao
  texto: string
  documento?: DocumentoINSS
}): AdapterImportacao<unknown> | null {
  const candidatos = ADAPTERS.filter((a) => a.fonte === params.fonte)

  if (params.documento) {
    return candidatos.find((a) => a.documento === params.documento) ?? null
  }

  return candidatos.find((a) => a.reconhece(params.texto)) ?? null
}

/**
 * SHA-256 do texto de origem.
 *
 * Serve para provar que o registro corresponde ao documento oficial e
 * para detectar reimportação do mesmo arquivo, sem guardar o conteúdo.
 * Usa a Web Crypto do runtime, disponível no Node do Next.
 */
export async function hashOrigem(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
