import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import {
  CATEGORIAS_DOCUMENTO,
  isCategoriaDocumento,
  type CategoriaDocumento,
} from "@/lib/domain/documento"
import { ESPECIES_BENEFICIO } from "@/lib/domain/beneficio"

/**
 * Triagem de laudo médico para fins previdenciários.
 *
 * Não é transcrição. Transcrever o CID economiza uma digitação; a
 * triagem economiza a leitura — o advogado abre a lista e já sabe se
 * aquele laudo sustenta incapacidade, se tem nexo com o trabalho e
 * onde o INSS vai atacar, antes de abrir o PDF.
 *
 * Tudo aqui é rascunho para revisão humana. Laudo tem letra de médico,
 * carimbo torto e foto com sombra, e a leitura chega à interface
 * marcada como leitura de máquina.
 */

const MODELO = "claude-opus-5"

/**
 * `medium` e não `low`: além de ler, o modelo pesa se a redação
 * sustenta incapacidade e o que fragiliza o laudo. Isso é julgamento,
 * não transcrição — no esforço mínimo os pontos fracos saem genéricos.
 */
const ESFORCO = "medium"

export type Incapacidade =
  | "TEMPORARIA"
  | "PERMANENTE"
  | "NAO_CARACTERIZADA"
  | "NAO_INFORMADA"

export type Alcance = "TOTAL" | "PARCIAL" | "NAO_INFORMADO"

export type NexoOcupacional = "SIM" | "NAO" | "NAO_INFORMADO"

export type TriagemLaudo = {
  /** Nome da doença como o laudo descreve. */
  patologia?: string
  cid?: string
  incapacidade: Incapacidade
  alcance: Alcance
  /**
   * Decide a espécie: com nexo o benefício é acidentário (B91), sem
   * nexo é previdenciário (B31). Muda carência, estabilidade no
   * emprego e valor.
   */
  nexoOcupacional: NexoOcupacional
  /** DID — data de início da doença. */
  dataInicioDoenca?: string
  /** DII — data de início da incapacidade. É a que fixa a DIB. */
  dataInicioIncapacidade?: string
  diasAfastamento?: number
  dataEmissao?: string
  medico?: string
  crm?: string
}

/** O que faz o INSS descartar um laudo por vício de forma. */
export type ValidadeLaudo = {
  temAssinatura: boolean
  temCarimbo: boolean
  crmLegivel: boolean
  temData: boolean
}

export type LeituraDocumento = {
  categoria: CategoriaDocumento
  /** Uma frase de triagem, para a lista e para o WhatsApp. */
  resumo: string
  triagem: TriagemLaudo
  validade: ValidadeLaudo
  /** Onde o INSS pode se apoiar para negar. */
  pontosFracos: string[]
  /** Espécie compatível com o quadro descrito. */
  beneficioSugerido?: string
  /** O que não deu para ler — separado do que foi lido. */
  ilegivel: string[]
  tarefaSugerida?: { titulo: string; prazo?: string }
  modelo: string
}

export type ResultadoLeitura =
  | { ok: true; leitura: LeituraDocumento }
  | { ok: false; motivo: "sem_chave" | "recusado" | "ilegivel" | "erro_api" }

const ESQUEMA = {
  type: "object",
  properties: {
    categoria: { type: "string", enum: [...CATEGORIAS_DOCUMENTO] },
    resumo: { type: "string" },
    triagem: {
      type: "object",
      properties: {
        patologia: { type: "string" },
        cid: { type: "string" },
        incapacidade: {
          type: "string",
          enum: ["TEMPORARIA", "PERMANENTE", "NAO_CARACTERIZADA", "NAO_INFORMADA"],
        },
        alcance: { type: "string", enum: ["TOTAL", "PARCIAL", "NAO_INFORMADO"] },
        nexoOcupacional: { type: "string", enum: ["SIM", "NAO", "NAO_INFORMADO"] },
        dataInicioDoenca: { type: "string", format: "date" },
        dataInicioIncapacidade: { type: "string", format: "date" },
        diasAfastamento: { type: "integer" },
        dataEmissao: { type: "string", format: "date" },
        medico: { type: "string" },
        crm: { type: "string" },
      },
      required: ["incapacidade", "alcance", "nexoOcupacional"],
      additionalProperties: false,
    },
    validade: {
      type: "object",
      properties: {
        temAssinatura: { type: "boolean" },
        temCarimbo: { type: "boolean" },
        crmLegivel: { type: "boolean" },
        temData: { type: "boolean" },
      },
      required: ["temAssinatura", "temCarimbo", "crmLegivel", "temData"],
      additionalProperties: false,
    },
    pontosFracos: { type: "array", items: { type: "string" } },
    beneficioSugerido: { type: "string", enum: [...ESPECIES_BENEFICIO] },
    ilegivel: { type: "array", items: { type: "string" } },
    tarefaSugerida: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        prazo: { type: "string", format: "date" },
      },
      required: ["titulo"],
      additionalProperties: false,
    },
  },
  required: [
    "categoria",
    "resumo",
    "triagem",
    "validade",
    "pontosFracos",
    "ilegivel",
  ],
  additionalProperties: false,
} as const

const INSTRUCOES = `Você faz a triagem de laudos médicos para um escritório de advocacia previdenciária brasileiro. O advogado vai revisar tudo — seu trabalho é fazer com que ele saiba do que se trata antes de abrir o documento.

NUNCA inclua nome, CPF, RG, endereço, telefone ou data de nascimento do paciente em nenhum campo. O escritório já tem esses dados no cadastro; repeti-los aqui só criaria mais uma cópia de dado sensível. Escreva "o titular". Nome e CRM do médico são exceção: identificam quem assina, e o escritório precisa deles.

Transcreva o que está escrito. Não complete, não deduza e não corrija: se o CID está borrado, ele é ilegível. Um CID inventado faria protocolar o pedido errado.

Como preencher cada campo:

- "incapacidade": só marque TEMPORARIA ou PERMANENTE se o laudo afirmar. Laudo que descreve doença sem falar em incapacidade para o trabalho é NAO_INFORMADA — doença e incapacidade são coisas diferentes, e essa confusão é o erro mais caro no requerimento.
- "alcance": TOTAL quando impede qualquer trabalho, PARCIAL quando impede a atividade habitual mas admite outras.
- "nexoOcupacional": SIM só quando o laudo ligar a doença ao trabalho (menção a CAT, acidente de trabalho, doença ocupacional, atividade exercida). Isso decide entre benefício acidentário e previdenciário, então na dúvida use NAO_INFORMADO.
- "dataInicioDoenca" (DID) e "dataInicioIncapacidade" (DII): datas diferentes. A DII é a que fixa o início do benefício. Só preencha o que estiver declarado.
- "validade": olhe o documento, não o texto. Um laudo sem assinatura, sem carimbo ou sem data é descartado pelo INSS por vício de forma, por melhor que seja o conteúdo.
- "pontosFracos": em português, o que o INSS pode usar para negar. Seja concreto — "não indica a data de início da incapacidade", "não menciona limitação funcional", "atestado genérico, sem exame que o sustente". Lista vazia se o laudo é sólido. Não repita aqui o que já está em "ilegivel".
- "beneficioSugerido": a espécie compatível com o quadro descrito, ou omita se o laudo não permitir concluir.
- "ilegivel": o que você não conseguiu ler no documento (ex.: "assinatura do médico", "data no carimbo").
- "resumo": uma frase que o advogado leria no celular e já saberia do que se trata. Comece pela patologia e pelo que o laudo sustenta.
- "tarefaSugerida": só quando houver ação com data — fim do afastamento, retorno para reavaliação.

Se o documento não for um laudo ou atestado médico, preencha "categoria" com o que ele é e diga isso no "resumo".`

/**
 * Lê páginas já tratadas (JPEG). O chamador confere base legal,
 * autorização de IA e categoria antes de chamar — este módulo não
 * conhece titular nem consentimento.
 */
export async function lerDocumento(
  paginasJpeg: Buffer[]
): Promise<ResultadoLeitura> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, motivo: "sem_chave" }
  }

  if (paginasJpeg.length === 0) {
    return { ok: false, motivo: "ilegivel" }
  }

  const client = new Anthropic()

  try {
    const resposta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 4096,
      // Classificadores de segurança podem recusar conteúdo médico por
      // falso positivo. Com o fallback, a requisição é reexecutada em
      // outro modelo em vez de falhar na mão do operador.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: INSTRUCOES,
      output_config: {
        effort: ESFORCO,
        format: { type: "json_schema", schema: ESQUEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            ...paginasJpeg.map((jpeg) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: "image/jpeg" as const,
                data: jpeg.toString("base64"),
              },
            })),
            {
              type: "text" as const,
              text:
                paginasJpeg.length === 1
                  ? "Faça a triagem deste documento."
                  : `Faça a triagem deste documento de ${paginasJpeg.length} páginas, na ordem enviada.`,
            },
          ],
        },
      ],
    })

    // Precisa vir antes de ler `content`: numa recusa o array vem vazio
    // e indexar content[0] quebraria.
    if (resposta.stop_reason === "refusal") {
      console.error("Triagem de laudo recusada pelos classificadores")
      return { ok: false, motivo: "recusado" }
    }

    const bloco = resposta.content.find((b) => b.type === "text")
    if (!bloco || bloco.type !== "text") {
      return { ok: false, motivo: "ilegivel" }
    }

    const bruto = JSON.parse(bloco.text) as Record<string, unknown>

    return {
      ok: true,
      leitura: {
        categoria: isCategoriaDocumento(bruto.categoria)
          ? bruto.categoria
          : "OUTRO",
        resumo: String(bruto.resumo ?? "").slice(0, 500),
        triagem: bruto.triagem as TriagemLaudo,
        validade: bruto.validade as ValidadeLaudo,
        pontosFracos: Array.isArray(bruto.pontosFracos)
          ? bruto.pontosFracos.map(String)
          : [],
        beneficioSugerido:
          typeof bruto.beneficioSugerido === "string"
            ? bruto.beneficioSugerido
            : undefined,
        ilegivel: Array.isArray(bruto.ilegivel) ? bruto.ilegivel.map(String) : [],
        tarefaSugerida: bruto.tarefaSugerida as
          | { titulo: string; prazo?: string }
          | undefined,
        // `resposta.model` e não a constante: com fallback ativo, quem
        // respondeu pode não ser o modelo pedido.
        modelo: resposta.model,
      },
    }
  } catch (erro) {
    // A mensagem de erro pode carregar trecho do documento — nunca vai
    // inteira para o log.
    console.error(
      "Falha na triagem de laudo:",
      erro instanceof Error ? erro.name : "erro desconhecido"
    )
    return { ok: false, motivo: "erro_api" }
  }
}
