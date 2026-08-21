import Anthropic from "@anthropic-ai/sdk"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { Tela } from "./tela"
import { telaEmTexto } from "./tela"

/**
 * Quem decide o que preencher.
 *
 * O robô não sabe o que é um requerimento; ele sabe clicar e digitar.
 * A leitura da tela e a escolha de onde vai cada dado são desta
 * análise — é o que permite o site do INSS mudar de layout sem o
 * script virar sucata.
 *
 * A análise propõe; o executor verifica; a pessoa confere e envia.
 * Nenhuma dessas três camadas confia sozinha nas outras.
 */

const MODELO = "claude-opus-5"

/**
 * `high`: aqui a decisão é sobre dado de benefício de outra pessoa,
 * numa tela que ninguém conferiu antes. Errar campo custa uma viagem
 * ao INSS e, no pior caso, um requerimento indeferido.
 */
const ESFORCO = "high"

/**
 * Um arquivo da pasta do cliente, já baixado para o disco.
 *
 * A escolha de qual documento vai em qual campo é da análise, não do
 * código: o INSS pede "documento de identificação" numa tela e "laudo
 * médico" na seguinte, e só quem lê a tela sabe qual é qual. Por isso o
 * caso carrega a pasta inteira, com nome e categoria, em vez de um par
 * fixo de arquivos.
 */
export type DocumentoDoCaso = {
  id: string
  nome: string
  /** Categoria do CRM: LAUDO_MEDICO, CNIS, PROCURACAO… */
  categoria: string
  /** Caminho no disco desta máquina. */
  caminho: string
}

export type DadosDoCaso = {
  cliente: string
  cpf?: string
  beneficio: string
  nit?: string
  observacoes: string
  documentos: DocumentoDoCaso[]
}

export type Acao =
  | { tipo: "preencher"; ref: string; valor: string; porque: string }
  | { tipo: "selecionar"; ref: string; valor: string; porque: string }
  | { tipo: "clicar"; ref: string; porque: string }
  | { tipo: "anexar"; ref: string; documento: string; porque: string }

export type Plano =
  | { situacao: "agir"; leitura: string; acoes: Acao[] }
  | { situacao: "pronto"; leitura: string; acoes: [] }
  | { situacao: "impedido"; leitura: string; acoes: [] }

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["situacao", "leitura", "acoes"],
  properties: {
    situacao: {
      type: "string",
      enum: ["agir", "pronto", "impedido"],
      description:
        "agir: há o que preencher ou clicar nesta tela. pronto: o requerimento está preenchido e só falta a pessoa conferir e enviar. impedido: a tela pede algo que não está nos dados do caso, ou não é a tela esperada.",
    },
    leitura: {
      type: "string",
      description:
        "Uma frase dizendo que tela é esta e em que ponto do requerimento estamos. Escrita para a secretária ler.",
    },
    acoes: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "ref", "porque"],
        properties: {
          tipo: { type: "string", enum: ["preencher", "selecionar", "clicar", "anexar"] },
          ref: { type: "string", description: "O ref do elemento, exatamente como listado." },
          valor: { type: "string", description: "Texto a digitar, ou opção a escolher." },
          documento: {
            type: "string",
            description: "O id do documento a anexar, exatamente como listado na pasta do cliente.",
          },
          porque: {
            type: "string",
            description: "Em uma linha, por que este dado vai neste campo. A secretária lê isto.",
          },
        },
      },
    },
  },
} as const

const INSTRUCOES = `Você preenche requerimentos administrativos do INSS junto com uma secretária de escritório de advocacia previdenciária.

Recebe a descrição de uma tela do Meu INSS e os dados de um caso. Responde o que fazer nessa tela.

REGRAS QUE NÃO SE NEGOCIAM:

1. Você NUNCA manda clicar em enviar, protocolar, finalizar, confirmar envio, assinar ou concluir o requerimento. Esse clique é da pessoa, sempre. Quando a tela estiver preenchida e só faltar isso, responda situacao="pronto".

2. Você só usa dados que estão no caso. Não inventa CPF, data, período, valor ou nome. Se um campo obrigatório pede algo que não está nos dados, responda situacao="impedido" e diga na leitura o que falta.

3. Você recebe uma imagem da tela e a lista de elementos. Use a imagem para entender o formulário — moldura, agrupamento, aviso em vermelho, rótulo solto ao lado do campo. Use a lista para endereçar: toda ação aponta um "ref" que está listado, e você nunca inventa um ref.

4. Prefira poucos passos por vez. Se um clique muda a tela (abre etapa, avança formulário), mande esse clique e pare — a próxima tela será lida de novo.

5. O campo de busca de serviço recebe o nome do benefício. O campo de observações recebe o texto de fundamentação do caso, inteiro, sem resumir.

5b. Ao anexar, escolha o documento pela categoria e pelo nome, conforme o que a tela está pedindo. Se a tela pede um documento que não existe na pasta, não substitua por outro: responda situacao="impedido" dizendo qual falta.

6. Pop-up de atualização cadastral, aviso de cookies ou pesquisa de satisfação: mande fechar/avançar, e diga isso no porque.

O "porque" de cada ação é lido por uma pessoa que vai conferir seu trabalho. Escreva para ela, não para um log.`

export type Analista = (entrada: {
  tela: Tela
  /** A tela em PNG base64. A análise olha, não só lê. */
  captura?: string
  dados: DadosDoCaso
  historico: string[]
}) => Promise<Plano>

/**
 * A credencial existe?
 *
 * O SDK constrói o cliente sem reclamar e só falha na primeira
 * requisição — que aqui acontece com o navegador já aberto e a
 * secretária esperando. Melhor descobrir antes de começar.
 */
/** Há credencial da Anthropic disponível? Não levanta erro. */
export function temCredencial(): boolean {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return true
  if (process.env.ANTHROPIC_AUTH_TOKEN?.trim()) return true
  return existsSync(join(homedir(), ".config", "anthropic"))
}

export function conferirCredencial() {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return
  if (process.env.ANTHROPIC_AUTH_TOKEN?.trim()) return

  // Chave em variável não é o único caminho: `ant auth login` guarda um
  // perfil em disco que o SDK lê sozinho. Não conferir isso rejeitaria
  // uma instalação perfeitamente válida.
  const perfil = join(homedir(), ".config", "anthropic")
  if (existsSync(perfil)) return

  throw new Error(
    "sem credencial da Anthropic — a análise não roda.\n" +
      "    Preencha ANTHROPIC_API_KEY no .env (a mesma que a triagem do DJEN usa),\n" +
      "    ou autentique com `ant auth login`, e rode de novo."
  )
}

/** O analista de verdade. */
export function analistaClaude(client = new Anthropic()): Analista {
  return async ({ tela, captura, dados, historico }) => {
    const caso = [
      `Cliente: ${dados.cliente}`,
      `Benefício requerido: ${dados.beneficio}`,
      dados.nit ? `NIT: ${dados.nit}` : null,
      dados.cpf ? `CPF: ${dados.cpf}` : null,
      "",
      dados.documentos.length
        ? `Pasta do cliente (use o id ao anexar):\n${dados.documentos
            .map((d) => `  ${d.id} — ${d.nome} [${d.categoria}]`)
            .join("\n")}`
        : "Pasta do cliente: nenhum documento disponível.",
      "",
      `Texto de observações/fundamentação:`,
      dados.observacoes,
    ]
      .filter((l) => l !== null)
      .join("\n")

    const feito = historico.length
      ? `\n\nJá feito nas telas anteriores:\n${historico.map((h) => `- ${h}`).join("\n")}`
      : ""

    const resposta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 4096,
      // Requerimento previdenciário fala de doença, morte e invalidez. O
      // fallback evita que um falso positivo de classificador trave a
      // secretária no meio do atendimento.
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
          // A imagem antes do texto: a análise olha a tela e depois lê a
          // lista de elementos, que é o que dá endereço ao que ela viu.
          content: [
            ...(captura
              ? ([
                  {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: "image/png" as const,
                      data: captura,
                    },
                  },
                ] as const)
              : []),
            {
              type: "text" as const,
              text: `DADOS DO CASO\n${caso}${feito}\n\nTELA ATUAL (a imagem acima; os "ref" abaixo são como você endereça cada elemento)\n${telaEmTexto(tela)}`,
            },
          ],
        },
      ],
    })

    // Antes de ler `content`: numa recusa o array volta vazio.
    if (resposta.stop_reason === "refusal") {
      return {
        situacao: "impedido",
        leitura:
          "A análise foi recusada pelos classificadores de segurança. Preencha esta tela à mão.",
        acoes: [],
      }
    }

    const bloco = resposta.content.find((b) => b.type === "text")
    if (!bloco || bloco.type !== "text") {
      return { situacao: "impedido", leitura: "A análise não devolveu resposta legível.", acoes: [] }
    }

    return JSON.parse(bloco.text) as Plano
  }
}
