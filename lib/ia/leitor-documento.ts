import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import {
  CATEGORIAS_DOCUMENTO,
  isCategoriaDocumento,
  type CategoriaDocumento,
} from "@/lib/domain/documento"

/**
 * Leitura de documento previdenciário por IA.
 *
 * Só isto usa modelo: classificar o documento e extrair os campos que
 * o escritório precisa digitar à mão hoje. Tratar imagem e montar PDF
 * ficam em `lib/documentos/imagem.ts`, com bibliotecas — modelo de
 * linguagem não produz imagem, e usá-lo para isso seria caro e pior.
 *
 * O que sai daqui é sugestão, não verdade. Laudo tem letra de médico,
 * carimbo torto e foto com sombra; a interface mostra o que foi lido
 * para conferência antes de virar tarefa.
 */

const MODELO = "claude-opus-5"

/**
 * `low` porque isto é extração estruturada, não raciocínio aberto: o
 * documento está na imagem, basta lê-lo. Esforço alto aqui gastaria
 * tokens de pensamento sem melhorar a transcrição.
 */
const ESFORCO = "low"

export type CampoLaudo = {
  cid?: string
  medico?: string
  crm?: string
  dataEmissao?: string
  diasAfastamento?: number
  dataInicioAfastamento?: string
  observacao?: string
}

export type LeituraDocumento = {
  categoria: CategoriaDocumento
  /** Uma frase para a lista da pasta. */
  resumo: string
  campos: CampoLaudo
  /** O que o modelo não conseguiu ler — importante para a conferência. */
  ilegivel: string[]
  /** Título sugerido para a tarefa de acompanhamento, se houver. */
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
    campos: {
      type: "object",
      properties: {
        cid: { type: "string" },
        medico: { type: "string" },
        crm: { type: "string" },
        dataEmissao: { type: "string", format: "date" },
        diasAfastamento: { type: "integer" },
        dataInicioAfastamento: { type: "string", format: "date" },
        observacao: { type: "string" },
      },
      required: [],
      additionalProperties: false,
    },
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
  required: ["categoria", "resumo", "campos", "ilegivel"],
  additionalProperties: false,
} as const

const INSTRUCOES = `Você lê documentos de processos previdenciários brasileiros do INSS para um escritório de advocacia.

Transcreva o que está no documento. Não complete, não deduza e não corrija o que estiver escrito: se o CID está borrado, ele é ilegível, e um CID inventado faria o escritório protocolar um pedido errado.

Regras de extração:
- "cid": código como aparece (ex.: "M54.5"). Só preencha se conseguir ler os caracteres com certeza.
- "diasAfastamento": apenas quando o documento declarar o período de afastamento em dias.
- "dataEmissao" e "dataInicioAfastamento": formato AAAA-MM-DD.
- "ilegivel": liste em português o que você não conseguiu ler (ex.: "assinatura do médico", "data no carimbo"). Lista vazia se leu tudo.
- "resumo": uma frase, sem repetir o nome do titular.
- "tarefaSugerida": só quando o documento gerar uma ação com data — fim de afastamento, retorno para reavaliação. Não sugira tarefa para RG ou comprovante de residência.

Escolha "categoria" pelo que o documento é, não pelo que ele menciona.`

/**
 * Lê páginas já tratadas (JPEG). O chamador é responsável por conferir
 * a base legal e a autorização de IA antes de chamar — este módulo não
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
      // outro modelo em vez de simplesmente falhar na mão do operador.
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
                  ? "Leia este documento."
                  : `Leia este documento de ${paginasJpeg.length} páginas, na ordem enviada.`,
            },
          ],
        },
      ],
    })

    // Precisa vir antes de ler `content`: numa recusa o array vem vazio
    // e indexar content[0] quebraria.
    if (resposta.stop_reason === "refusal") {
      console.error("Leitura de documento recusada pelos classificadores")
      return { ok: false, motivo: "recusado" }
    }

    const bloco = resposta.content.find((b) => b.type === "text")
    if (!bloco || bloco.type !== "text") {
      return { ok: false, motivo: "ilegivel" }
    }

    const bruto = JSON.parse(bloco.text) as Record<string, unknown>

    const categoria = isCategoriaDocumento(bruto.categoria)
      ? bruto.categoria
      : "OUTRO"

    return {
      ok: true,
      leitura: {
        categoria,
        resumo: String(bruto.resumo ?? "").slice(0, 500),
        campos: (bruto.campos ?? {}) as CampoLaudo,
        ilegivel: Array.isArray(bruto.ilegivel)
          ? bruto.ilegivel.map(String)
          : [],
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
      "Falha ao ler documento por IA:",
      erro instanceof Error ? erro.name : "erro desconhecido"
    )
    return { ok: false, motivo: "erro_api" }
  }
}
