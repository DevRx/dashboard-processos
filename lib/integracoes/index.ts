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
 * Escolhe o adapter a partir do próprio conteúdo colado.
 *
 * `fonte` e `documento` são desempates opcionais: informados, mandam.
 * Sem eles, varre todos os adapters e deixa o texto se identificar — é
 * o caminho normal, porque o documento diz de onde veio.
 */
export function selecionarAdapter(params: {
  fonte?: FonteIntegracao
  texto: string
  documento?: DocumentoINSS
}): AdapterImportacao<unknown> | null {
  const candidatos = params.fonte
    ? ADAPTERS.filter((a) => a.fonte === params.fonte)
    : ADAPTERS

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
