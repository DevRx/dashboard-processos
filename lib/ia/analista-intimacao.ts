import "server-only"
import Anthropic from "@anthropic-ai/sdk"

/**
 * Triagem da intimação publicada no diário.
 *
 * O que o escritório precisa saber antes de abrir o texto: do que se
 * trata, o que precisa ser feito, se o prazo é dele ou de outra parte,
 * e o quanto isso corre. A leitura por padrão já pega o número de dias
 * — o que ela não consegue é dizer se aqueles "60 dias corridos" são
 * do INSS para implantar o benefício ou do advogado para se
 * manifestar. É essa diferença que justifica a leitura por modelo.
 *
 * Rascunho para revisão humana: o texto do diário continua no cartão,
 * e a data da tarefa segue editável.
 */

const MODELO = "claude-opus-5"

/**
 * `low`: o texto já diz o que fazer, o trabalho é extrair e
 * classificar. Esforço maior aqui gastaria tempo numa fila que pode
 * ter dezenas de itens por dia sem mudar a resposta.
 */
const ESFORCO = "low"

/** Teto do texto enviado: intimação longa é repetição de rodapé. */
const LIMITE_TEXTO = 6000

export type UrgenciaIA = "ALTA" | "MEDIA" | "BAIXA"
export type PrazoDeQuem = "ESCRITORIO" | "OUTRA_PARTE" | "NENHUM"

export type AnaliseIntimacao = {
  /** Nome do ato em poucas palavras: "Despacho de emenda à inicial". */
  tipoAto: string
  /** Uma frase: o que aconteceu no processo. */
  resumo: string
  /** O que o escritório precisa fazer. Vazio quando não há ação. */
  providencia: string
  urgencia: UrgenciaIA
  prazoDeQuem: PrazoDeQuem
  prazoDias?: number
  /** O que merece atenção: pena de extinção, multa, ato personalíssimo. */
  alertas: string[]
}

export type ResultadoAnalise =
  | { ok: true; analise: AnaliseIntimacao; modelo: string }
  | { ok: false; motivo: "sem_chave" | "recusado" | "falhou" }

const ESQUEMA = {
  type: "object",
  properties: {
    tipoAto: { type: "string" },
    resumo: { type: "string" },
    providencia: { type: "string" },
    urgencia: { type: "string", enum: ["ALTA", "MEDIA", "BAIXA"] },
    prazoDeQuem: {
      type: "string",
      enum: ["ESCRITORIO", "OUTRA_PARTE", "NENHUM"],
    },
    prazoDias: { type: "integer" },
    alertas: { type: "array", items: { type: "string" } },
  },
  required: ["tipoAto", "resumo", "providencia", "urgencia", "prazoDeQuem", "alertas"],
  additionalProperties: false,
} as const

const INSTRUCOES = `Você faz a triagem das intimações publicadas no Diário de Justiça Eletrônico Nacional para um escritório de advocacia previdenciária brasileiro, que atua para a parte autora contra o INSS. O advogado revisa tudo — seu trabalho é fazer com que ele saiba o que é e o que fazer sem abrir a publicação inteira.

NUNCA repita nome, CPF, RG, endereço ou data de nascimento de nenhuma parte. O escritório já tem esses dados no cadastro. Escreva "a parte autora", "o autor", "a ré". Nome de juiz, vara e tribunal podem aparecer.

Escreva em português do Brasil, direto, sem juridiquês desnecessário e sem repetir o texto do diário.

Como preencher:

- "tipoAto": o ato em poucas palavras — "Despacho de emenda à inicial", "Sentença de procedência", "Intimação para perícia", "Ato ordinatório para contrarrazões".
- "resumo": uma frase dizendo o que aconteceu no processo.
- "providencia": o que o ESCRITÓRIO precisa fazer, no imperativo — "Emendar a inicial juntando CNIS e CTPS", "Apresentar contrarrazões", "Levar o autor à perícia na data designada". String vazia quando não há nada a fazer (ciência de ato, mero andamento).
- "prazoDeQuem": de quem é o prazo citado no texto. ESCRITORIO quando corre contra a parte autora ou seu advogado. OUTRA_PARTE quando é do INSS, do perito, do juízo (exemplo comum: "o INSS implantará o benefício em 60 dias" é OUTRA_PARTE). NENHUM quando não há prazo. Este campo é o mais importante: um prazo de outra parte anotado como do escritório enche a agenda de tarefa que não existe.
- "prazoDias": o número de dias do prazo do ESCRITÓRIO, quando houver. Omita se o prazo for de outra parte ou não houver.
- "urgencia": ALTA quando há ato a praticar com prazo, ou pena de extinção, arquivamento, preclusão ou multa. MEDIA quando há ato sem gravidade imediata. BAIXA para ciência, mero andamento e prazos de outra parte.
- "alertas": o que muda a conduta — "sob pena de extinção sem resolução do mérito", "perícia é ato personalíssimo, o autor precisa comparecer", "exige procuração com poderes especiais". Lista vazia quando não houver.

Não invente prazo, data nem providência que o texto não traga.`

/** Recorta o miolo: cabeçalho e rodapé do diário não dizem nada. */
function prepararTexto(texto: string) {
  const limpo = texto.replace(/\s+/g, " ").trim()
  return limpo.length <= LIMITE_TEXTO ? limpo : `${limpo.slice(0, LIMITE_TEXTO)}…`
}

export async function analisarIntimacao(params: {
  texto: string
  tipoDocumento?: string | null
  nomeOrgao?: string | null
  nomeClasse?: string | null
}): Promise<ResultadoAnalise> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, motivo: "sem_chave" }
  }

  if (!params.texto?.trim()) {
    return { ok: false, motivo: "falhou" }
  }

  const client = new Anthropic()

  const contexto = [
    params.tipoDocumento ? `Tipo no diário: ${params.tipoDocumento}` : null,
    params.nomeClasse ? `Classe processual: ${params.nomeClasse}` : null,
    params.nomeOrgao ? `Órgão: ${params.nomeOrgao}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const resposta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 2048,
      // Publicação judicial fala de doença, morte e prisão. O fallback
      // evita que um falso positivo de classificador derrube a triagem
      // de uma fila inteira.
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
          content: `${contexto}\n\nPublicação:\n${prepararTexto(params.texto)}`,
        },
      ],
    })

    // Precisa vir antes de ler `content`: numa recusa o array vem vazio.
    if (resposta.stop_reason === "refusal") {
      console.error("Triagem de intimação recusada pelos classificadores")
      return { ok: false, motivo: "recusado" }
    }

    const bloco = resposta.content.find((b) => b.type === "text")
    if (!bloco || bloco.type !== "text") {
      return { ok: false, motivo: "falhou" }
    }

    const analise = JSON.parse(bloco.text) as AnaliseIntimacao

    return { ok: true, analise, modelo: resposta.model ?? MODELO }
  } catch (erro) {
    console.error("Triagem de intimação:", erro)
    return { ok: false, motivo: "falhou" }
  }
}
