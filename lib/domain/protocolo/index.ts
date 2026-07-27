// ─────────────────────────────────────────────────────────
// Domínio: preparo do protocolo administrativo
//
// O CRM não protocola — não existe API, e desde 30/06/2026 o acesso a
// sistemas externos do INSS exige certificado A3 ICP-Brasil, cuja
// chave privada não sai do token. O que o sistema pode fazer é chegar
// no GERID com tudo conferido, para o protocolo levar minutos em vez
// de virar uma viagem perdida.
//
// Aqui vive o que dá para verificar sozinho: dado do segurado que o
// INSS vai exigir, base legal, e o impedimento de requerimento
// duplicado. O checklist de documentos é guia, não verificação — o
// sistema não tem como saber o que está na pasta física.
// ─────────────────────────────────────────────────────────

/** Link do canal oficial. O GERID não publica deep link por serviço. */
export const URL_GERID = "https://novorequerimento.inss.gov.br/"

export type Gravidade = "bloqueio" | "aviso"

export type Pendencia = {
  gravidade: Gravidade
  texto: string
}

/**
 * Status em que o INSS considera o requerimento em andamento.
 *
 * `RECUSADO` fica de fora de propósito: indeferido não impede novo
 * pedido por si, mas pode haver recurso em curso — o que o sistema não
 * tem como saber. Vira aviso, não bloqueio.
 */
const STATUS_EM_ANDAMENTO = [
  "EM_ANALISE",
  "AGUARDANDO_INSS",
  "PERICIA_MARCADA",
  "PERICIA_CONCLUIDA",
]

const DOCUMENTOS_COMUNS = [
  "Documento de identificação com foto e CPF do segurado",
  "Comprovante de residência atualizado",
  "Procuração e documento de identificação do procurador",
]

/**
 * Documentos exigidos por espécie, além dos comuns.
 *
 * É guia de conferência, não lista legal exaustiva: a exigência varia
 * com o caso concreto e o INSS muda os requisitos por instrução
 * normativa. Serve para não esquecer o óbvio na hora de montar a pasta.
 */
export const DOCUMENTOS_POR_ESPECIE: Record<string, string[]> = {
  "Aposentadoria por idade": [
    "Extrato CNIS",
    "Carteiras de trabalho de todos os vínculos",
    "Carnês de contribuição, se contribuinte individual",
  ],
  "Aposentadoria por idade rural": [
    "Autodeclaração rural",
    "Documentos de comprovação de atividade rural (notas de produtor, contrato de parceria, ITR, declaração de sindicato)",
    "Extrato CNIS",
  ],
  "Aposentadoria por tempo de contribuição": [
    "Extrato CNIS",
    "Carteiras de trabalho de todos os vínculos",
    "PPP, se houver período em atividade especial",
  ],
  "Aposentadoria especial": [
    "PPP — Perfil Profissiográfico Previdenciário",
    "LTCAT dos períodos alegados",
    "Extrato CNIS",
  ],
  "Aposentadoria da pessoa com deficiência": [
    "Documentos médicos que comprovem a deficiência e sua data de início",
    "Extrato CNIS",
    "Avaliação biopsicossocial é feita pelo próprio INSS",
  ],
  "Aposentadoria por incapacidade permanente": [
    "Laudos e relatórios médicos recentes, com CID",
    "Exames complementares",
    "Comprovante de afastamento do trabalho",
  ],
  "Auxílio por incapacidade temporária": [
    "Atestado ou relatório médico recente, com CID e prazo de afastamento",
    "Exames complementares",
    "Comprovante de afastamento do trabalho",
  ],
  "Auxílio-acidente": [
    "Laudos médicos que demonstrem a sequela",
    "CAT — Comunicação de Acidente de Trabalho, se houver",
    "Exames complementares",
  ],
  "Salário-maternidade": [
    "Certidão de nascimento, ou termo de guarda/adoção",
    "Atestado médico, em caso de parto antecipado ou natimorto",
    "Autodeclaração rural, se segurada especial",
  ],
  "Pensão por morte": [
    "Certidão de óbito",
    "Certidão de casamento ou prova de união estável",
    "Documentos de identificação de todos os dependentes",
  ],
  "Auxílio-reclusão": [
    "Certidão ou atestado de recolhimento à prisão, atualizado",
    "Documentos de identificação dos dependentes",
    "Comprovação do último salário de contribuição do segurado",
  ],
  "BPC/LOAS — idoso": [
    "CadÚnico atualizado",
    "Documentos de identificação de todo o grupo familiar",
    "Comprovação de renda do grupo familiar",
  ],
  "BPC/LOAS — pessoa com deficiência": [
    "CadÚnico atualizado",
    "Documentos médicos que comprovem a deficiência",
    "Documentos de identificação e renda de todo o grupo familiar",
  ],
  "Revisão de benefício": [
    "Carta de concessão e memória de cálculo",
    "Extrato CNIS",
    "Documentos que fundamentam a revisão pretendida",
  ],
}

export function documentosDaEspecie(beneficio?: string | null): {
  comuns: string[]
  especificos: string[]
  catalogado: boolean
} {
  const especificos = beneficio ? DOCUMENTOS_POR_ESPECIE[beneficio] : undefined
  return {
    comuns: DOCUMENTOS_COMUNS,
    especificos: especificos ?? [],
    catalogado: Boolean(especificos),
  }
}

type ClienteParaPreparo = {
  cpf?: string | null
  dataNascimento?: string | null
  telefone?: string | null
  email?: string | null
}

type ProcessoParaPreparo = {
  id: string
  beneficio: string
  esfera?: string | null
  status: string
  protocoloInss?: string | null
}

/**
 * Pendências que impedem ou atrapalham o protocolo.
 *
 * Bloqueio é o que o INSS recusaria; aviso é o que faz voltar depois.
 * A distinção importa: transformar tudo em bloqueio treina o operador
 * a ignorar o alerta.
 */
export function avaliarPreparo(params: {
  cliente: ClienteParaPreparo
  processo: ProcessoParaPreparo
  outrosProcessos: ProcessoParaPreparo[]
  baseLegal: { temVigente: boolean; temPdf: boolean }
}): Pendencia[] {
  const { cliente, processo, outrosProcessos, baseLegal } = params
  const pendencias: Pendencia[] = []

  if (!baseLegal.temVigente) {
    pendencias.push({
      gravidade: "bloqueio",
      texto:
        "Sem base legal vigente para este titular. Registre a procuração antes de tratar os dados.",
    })
  } else if (!baseLegal.temPdf) {
    pendencias.push({
      gravidade: "aviso",
      texto:
        "Procuração sem PDF anexado. O GERID exige a procuração cadastrada — tenha o arquivo em mãos.",
    })
  }

  if (!cliente.cpf) {
    pendencias.push({
      gravidade: "bloqueio",
      texto: "Cliente sem CPF. O requerimento é identificado pelo CPF do segurado.",
    })
  }

  if (!cliente.dataNascimento) {
    pendencias.push({
      gravidade: "aviso",
      texto: "Cliente sem data de nascimento — exigida em benefício por idade.",
    })
  }

  if (!cliente.telefone && !cliente.email) {
    pendencias.push({
      gravidade: "aviso",
      texto:
        "Cliente sem telefone nem e-mail. Exigência do INSS chega por contato: sem ele, o prazo corre sem ninguém saber.",
    })
  }

  // O INSS restringe novo requerimento do mesmo benefício enquanto
  // houver pedido em análise. Descobrir isso só na hora do protocolo é
  // trabalho jogado fora.
  const duplicado = outrosProcessos.find(
    (p) =>
      p.id !== processo.id &&
      p.beneficio === processo.beneficio &&
      (p.esfera ?? "ADMINISTRATIVO") === "ADMINISTRATIVO" &&
      STATUS_EM_ANDAMENTO.includes(p.status)
  )

  if (duplicado) {
    pendencias.push({
      gravidade: "bloqueio",
      texto: `Já existe requerimento de "${processo.beneficio}" em andamento${
        duplicado.protocoloInss ? ` (protocolo ${duplicado.protocoloInss})` : ""
      }. O INSS recusa novo pedido do mesmo benefício enquanto o anterior não se encerra.`,
    })
  }

  const indeferidoAntes = outrosProcessos.find(
    (p) =>
      p.id !== processo.id &&
      p.beneficio === processo.beneficio &&
      p.status === "RECUSADO"
  )

  if (indeferidoAntes) {
    pendencias.push({
      gravidade: "aviso",
      texto:
        "Houve indeferimento anterior do mesmo benefício. Se ainda cabe recurso, um novo requerimento pode ser recusado.",
    })
  }

  if (!documentosDaEspecie(processo.beneficio).catalogado) {
    pendencias.push({
      gravidade: "aviso",
      texto:
        "Benefício fora do catálogo — não tenho a lista de documentos desta espécie para conferir.",
    })
  }

  return pendencias
}

export function temBloqueio(pendencias: Pendencia[]): boolean {
  return pendencias.some((p) => p.gravidade === "bloqueio")
}
