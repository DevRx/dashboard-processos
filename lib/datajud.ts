import "server-only"

// API pública do DataJud (CNJ) — chave pública oficial, sem cadastro.
// Docs: https://datajud-wiki.cnj.jus.br/api-publica/
const DATAJUD_API_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="

// Segmento "4" no número CNJ = Justiça Federal. Os 2 dígitos seguintes
// identificam o TRF (01 a 06). É onde tramita a maior parte das ações
// previdenciárias contra o INSS.
const TRF_ENDPOINTS: Record<string, string> = {
  "01": "api_publica_trf1",
  "02": "api_publica_trf2",
  "03": "api_publica_trf3",
  "04": "api_publica_trf4",
  "05": "api_publica_trf5",
  "06": "api_publica_trf6",
}

export type DataJudResultado = {
  numeroProcesso: string
  classe?: string
  assuntos: string[]
  orgaoJulgador?: string
  dataAjuizamento?: string
  tribunal?: string
  grau?: string
  ultimoMovimento?: { nome: string; data?: string }
}

function limparNumero(numero: string) {
  return numero.replace(/\D/g, "")
}

/**
 * dataAjuizamento pode vir em ISO ("2020-08-04T15:29:58.000Z") ou no
 * formato bruto "AAAAMMDDHHmmss" (sem separadores), dependendo do
 * tribunal/sistema de origem. Normaliza sempre para "AAAA-MM-DD".
 */
function normalizarData(valor?: string): string | undefined {
  if (!valor) return undefined
  if (/^\d{14}$/.test(valor)) {
    return `${valor.slice(0, 4)}-${valor.slice(4, 6)}-${valor.slice(6, 8)}`
  }
  return valor.slice(0, 10)
}

/**
 * O número único CNJ segue o formato NNNNNNN-DD.AAAA.J.TR.OOOO.
 * Os dígitos de posição 14 (segmento) e 15-16 (tribunal) indicam onde
 * o processo tramita.
 */
function detectarEndpoint(numeroLimpo: string): string | null {
  if (numeroLimpo.length !== 20) return null
  const segmento = numeroLimpo.slice(13, 14)
  const tribunal = numeroLimpo.slice(14, 16)
  if (segmento !== "4") return null
  return TRF_ENDPOINTS[tribunal] || null
}

export async function consultarProcessoDataJud(
  numero: string
): Promise<{ ok: true; dados: DataJudResultado } | { ok: false; motivo: string }> {
  const numeroLimpo = limparNumero(numero)

  if (numeroLimpo.length !== 20) {
    return { ok: false, motivo: "invalid_format" }
  }

  const alias = detectarEndpoint(numeroLimpo)
  if (!alias) {
    return { ok: false, motivo: "unsupported_court" }
  }

  const response = await fetch(
    `https://api-publica.datajud.cnj.jus.br/${alias}/_search`,
    {
      method: "POST",
      headers: {
        Authorization: `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { match: { numeroProcesso: numeroLimpo } } }),
      cache: "no-store",
    }
  )

  if (!response.ok) {
    return { ok: false, motivo: "datajud_error" }
  }

  const json = await response.json()
  const hit = json?.hits?.hits?.[0]?._source

  if (!hit) {
    return { ok: false, motivo: "not_found" }
  }

  const movimentos = Array.isArray(hit.movimentos) ? hit.movimentos : []
  const ultimo = movimentos
    .slice()
    .sort((a: { dataHora?: string }, b: { dataHora?: string }) =>
      (b.dataHora || "").localeCompare(a.dataHora || "")
    )[0]

  return {
    ok: true,
    dados: {
      numeroProcesso: hit.numeroProcesso || numeroLimpo,
      classe: hit.classe?.nome,
      assuntos: Array.isArray(hit.assuntos)
        ? hit.assuntos.map((a: { nome?: string }) => a.nome).filter(Boolean)
        : [],
      orgaoJulgador: hit.orgaoJulgador?.nome,
      dataAjuizamento: normalizarData(hit.dataAjuizamento),
      tribunal: hit.tribunal,
      grau: hit.grau,
      ultimoMovimento: ultimo
        ? { nome: ultimo.nome, data: normalizarData(ultimo.dataHora) }
        : undefined,
    },
  }
}
