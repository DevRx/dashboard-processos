import "server-only"
import {
  dataBrParaIso,
  normalizarTexto,
  type AdapterImportacao,
  type Resultado,
} from "@/lib/integracoes/contrato"
import type { ProcessoStatus } from "@/lib/domain/processo"

/**
 * Importação assistida do GERID / Novo Requerimento INSS
 * (novorequerimento.inss.gov.br).
 *
 * Desde 25/09 o advogado com procuração cadastrada no Meu INSS acessa
 * ali a documentação do cliente sem a senha gov.br do segurado. O
 * login exige certificado digital A3 do advogado — hardware, atrelado
 * à máquina de quem opera. Não existe endpoint de API para terceiros,
 * e não haveria como o servidor autenticar mesmo se existisse.
 *
 * Então o fluxo é: o advogado abre o requerimento no GERID e cola aqui
 * o espelho. Este módulo estrutura o texto, deriva o status do
 * processo e calcula o prazo da exigência, que é o dado que realmente
 * some da vista e faz o escritório perder benefício.
 */

export type ExigenciaGerid = {
  descricao: string
  /** Data-limite de cumprimento informada pelo GERID. */
  prazoAte?: string
}

export type GeridResultado = {
  protocolo?: string
  servico?: string
  /** Situação como o GERID escreve, preservada para auditoria. */
  situacao?: string
  /** Situação traduzida para o vocabulário de status do dashboard. */
  statusSugerido?: ProcessoStatus
  dataEntrada?: string
  /** Unidade de Atendimento (APS) responsável pela análise. */
  unidade?: string
  exigencias: ExigenciaGerid[]
  /** Perícia médica agendada, quando o requerimento a exigir. */
  periciaEm?: string
  /**
   * Prazo mais urgente entre exigências e perícia. É o campo que a UI
   * usa para propor `processos.prazo`.
   */
  proximoPrazo?: string
}

/**
 * Tradução das situações do GERID para o ciclo de vida interno.
 *
 * Deliberadamente conservadora: situação desconhecida não vira
 * `statusSugerido`, para que a importação nunca mova um processo com
 * base num palpite. A UI então mantém o status atual e o operador
 * decide.
 */
const SITUACAO_STATUS: { padrao: RegExp; status: ProcessoStatus }[] = [
  { padrao: /conclu[íi]d[oa].*deferid|deferid/i, status: "BENEFICIO_CONCEDIDO" },
  { padrao: /indeferid|n[ãa]o reconhecid/i, status: "RECUSADO" },
  { padrao: /exig[êe]ncia/i, status: "AGUARDANDO_INSS" },
  { padrao: /per[íi]cia.*(agendad|marcad)|agendament.*per[íi]cia/i, status: "PERICIA_MARCADA" },
  { padrao: /per[íi]cia.*(realizad|conclu[íi]d)/i, status: "PERICIA_CONCLUIDA" },
  { padrao: /em an[áa]lise|em processamento|aguardando an[áa]lise/i, status: "EM_ANALISE" },
  { padrao: /aguardando.*INSS|encaminhad/i, status: "AGUARDANDO_INSS" },
  { padrao: /conclu[íi]d[oa]|encerrad/i, status: "CONCLUIDO" },
]

function derivarStatus(situacao?: string): ProcessoStatus | undefined {
  if (!situacao) return undefined
  return SITUACAO_STATUS.find((r) => r.padrao.test(situacao))?.status
}

function extrairGerid(textoBruto: string): Resultado<GeridResultado> {
  const texto = normalizarTexto(textoBruto)

  const protocolo = texto.match(
    /(?:Protocolo|N[úu]mero do requerimento|Requerimento)[:\s]*([\d.\-/]{6,25})/i
  )?.[1]
  const servico = texto.match(
    /(?:Servi[çc]o|Tipo de servi[çc]o|Benef[íi]cio)[:\s]*([^\n]{3,80})/i
  )?.[1]
  const situacao = texto.match(
    /(?:Situa[çc][ãa]o|Status|Fase)[:\s]*([^\n]{3,60})/i
  )?.[1]
  const dataEntrada = texto.match(
    /Data (?:de |do )?(?:entrada|protocolo|requerimento)[:\s]*(\d{2}\/\d{2}\/\d{4})/i
  )?.[1]
  const unidade = texto.match(
    /(?:Unidade|APS|Ag[êe]ncia)(?: de atendimento| respons[áa]vel)?[:\s]*([^\n]{3,80})/i
  )?.[1]

  // Exigência: a descrição vem numa linha e o prazo costuma aparecer
  // na mesma linha ou na seguinte. Aceitamos as duas formas.
  const exigencias: ExigenciaGerid[] = []
  const linhas = texto.split("\n")
  linhas.forEach((linha, i) => {
    if (!/exig[êe]ncia/i.test(linha)) return
    // A linha "Situação: Em exigência" não é uma exigência em si.
    if (/^(?:situa[çc][ãa]o|status|fase)\b/i.test(linha)) return

    const descricao = linha
      .replace(/^.*?exig[êe]ncia[:\s-]*/i, "")
      .replace(/\s{2,}/g, " ")
      .trim()
    if (descricao.length < 3) return

    const prazoNaLinha = linha.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1]
    const prazoNaSeguinte = /prazo|cumprir|at[ée]/i.test(linhas[i + 1] ?? "")
      ? linhas[i + 1].match(/(\d{2}\/\d{2}\/\d{4})/)?.[1]
      : undefined

    exigencias.push({
      descricao,
      prazoAte: dataBrParaIso(prazoNaLinha ?? prazoNaSeguinte),
    })
  })

  // A data pode vir antes ou depois da palavra "perícia", por isso as
  // duas alternativas — e por isso o grupo capturado pode ser o 2º.
  const matchPericia = texto.match(
    /per[íi]cia[^\n]*?(\d{2}\/\d{2}\/\d{4})|(\d{2}\/\d{2}\/\d{4})[^\n]*?per[íi]cia/i
  )
  const periciaEm = dataBrParaIso(matchPericia?.[1] ?? matchPericia?.[2])

  if (!protocolo && !situacao) {
    return { ok: false, motivo: "gerid_sem_dados" }
  }

  const prazos = [
    ...exigencias.map((e) => e.prazoAte),
    periciaEm,
  ].filter((p): p is string => Boolean(p))

  const situacaoLimpa = situacao?.replace(/\s{2,}/g, " ").trim()

  return {
    ok: true,
    dados: {
      protocolo: protocolo?.trim(),
      servico: servico?.replace(/\s{2,}/g, " ").trim(),
      situacao: situacaoLimpa,
      statusSugerido: derivarStatus(situacaoLimpa),
      dataEntrada: dataBrParaIso(dataEntrada),
      unidade: unidade?.replace(/\s{2,}/g, " ").trim(),
      exigencias,
      periciaEm,
      proximoPrazo: prazos.sort()[0],
    },
  }
}

export const adapterGerid: AdapterImportacao<GeridResultado> = {
  fonte: "GERID",
  modo: "importacao",
  documento: "REQUERIMENTO_GERID",
  reconhece: (texto) =>
    /GERID|Novo Requerimento|novorequerimento\.inss|INSS Digital/i.test(texto),
  extrair: extrairGerid,
}
