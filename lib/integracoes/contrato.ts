import "server-only"

/**
 * Contrato comum das integrações externas.
 *
 * Há dois modos possíveis, e a diferença não é técnica — é jurídica:
 *
 * - `consulta`: a fonte tem API pública e dados públicos por lei.
 *   Só o DataJud (CNJ) se encaixa: chave pública, sem cadastro,
 *   publicidade dos atos processuais.
 *
 * - `importacao`: a fonte só é acessível pela sessão autenticada do
 *   próprio operador. Meu INSS exige login gov.br do titular ou
 *   procuração cadastrada; GERID exige certificado A3 do advogado,
 *   que é hardware e não trafega para o servidor. Não existe API de
 *   terceiros para nenhum dos dois. O operador extrai o documento
 *   oficial e o adapter estrutura o texto.
 *
 * Nenhum adapter guarda credencial. Se algum dia um adapter precisar
 * de senha gov.br de terceiro, ele está errado — não há base legal
 * para custodiar credencial de titular.
 */
export type ModoIntegracao = "consulta" | "importacao"

export type FonteIntegracao = "DATAJUD" | "MEU_INSS" | "GERID"

export type DocumentoINSS =
  | "CNIS"
  | "CARTA_CONCESSAO"
  | "CARTA_INDEFERIMENTO"
  | "EXTRATO_PAGAMENTO"
  | "REQUERIMENTO_GERID"

export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; motivo: string }

/**
 * Adapter de importação assistida. `reconhece` permite detectar o
 * tipo de documento a partir do texto colado, para que a UI não
 * obrigue o operador a classificar manualmente.
 */
export type AdapterImportacao<T> = {
  fonte: FonteIntegracao
  modo: "importacao"
  documento: DocumentoINSS
  reconhece: (texto: string) => boolean
  extrair: (texto: string) => Resultado<T>
}

/** Normaliza texto colado de PDF: espaços múltiplos, NBSP, CRLF. */
export function normalizarTexto(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((linha) => linha.trim())
    .join("\n")
    .trim()
}

/** "04/08/2020" → "2020-08-04". Devolve undefined se não casar. */
export function dataBrParaIso(valor?: string): string | undefined {
  if (!valor) return undefined
  const m = valor.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return undefined
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** "1.234,56" → 1234.56. Devolve undefined se não casar. */
export function moedaBrParaNumero(valor?: string): number | undefined {
  if (!valor) return undefined
  const limpo = valor.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")
  const n = Number(limpo)
  return Number.isFinite(n) ? n : undefined
}

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "")
}
