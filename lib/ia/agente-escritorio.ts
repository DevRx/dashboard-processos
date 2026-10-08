import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { BASE_CONHECIMENTO } from "@/lib/ia/base-conhecimento"

/**
 * Agente do escritório — o assistente com que a equipe conversa dentro
 * do sistema.
 *
 * Mesma infra da triagem de intimação (lib/ia/analista-intimacao):
 * modelo claude-opus-5, `new Anthropic()` lendo ANTHROPIC_API_KEY do
 * ambiente, fallback do lado do servidor para um falso positivo de
 * classificador não derrubar a resposta. Sem a chave, devolve
 * `sem_chave` e a tela avisa — nada estoura.
 *
 * O que o agente NÃO faz: executar. Ele responde, explica e PREPARA
 * minutas, mas qualquer coisa que mexa em processo, protocolo ou no
 * INSS ele entrega como rascunho para a aprovação de uma pessoa — é a
 * mesma regra da varredura e do preparo de protocolo. O conhecimento
 * que ele usa é o do escritório (lib/ia/base-conhecimento), editável
 * pela equipe; ele não tem acesso a memória de fora do sistema.
 */

const MODELO = "claude-opus-5"
const LIMITE_HISTORICO = 12

export type Mensagem = { autor: "pessoa" | "agente"; texto: string }

export type RespostaAgente =
  | { ok: true; resposta: string; modelo: string }
  | { ok: false; motivo: "sem_chave" | "recusado" | "falhou" }

function instrucoes(nomeUsuario: string): string {
  return `Você é o assistente interno do escritório ZECAPOSENTA (advocacia previdenciária, Brasília/DF, atua para a parte autora contra o INSS). Está conversando com ${nomeUsuario}, da equipe. Responda em português do Brasil, direto e didático, sem juridiquês desnecessário.

O que você faz:
- Responde dúvidas sobre os casos, os prazos e o funcionamento do escritório usando a base de conhecimento abaixo.
- Ajuda a redigir e a organizar: minutas, resumos, rascunhos de mensagem, checklists.
- Quando pedirem uma ação que mexe no mundo (protocolar, enviar, peticionar, mexer no INSS), você PREPARA o rascunho e diz claramente que fica para a aprovação do advogado. Você nunca afirma ter executado nada.

Limites:
- Você não acessa o Meu INSS nem faz login por ninguém. Acompanhamento de INSS é pela Central do INSS do sistema (procuração eletrônica ou fluxo assistido).
- Nunca repita CPF, senha, RG ou endereço de cliente. Esses dados moram no cadastro, não na conversa.
- Não invente fato de processo, prazo, data ou jurisprudência. Se não souber, diga que não sabe e aponte onde conferir.
- Peça judicial e peça administrativa seguem o padrão visual law do escritório; lembre disso quando for redigir.

BASE DE CONHECIMENTO DO ESCRITÓRIO
${BASE_CONHECIMENTO}`
}

export async function responderPergunta(params: {
  pergunta: string
  nomeUsuario: string
  historico?: Mensagem[]
}): Promise<RespostaAgente> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, motivo: "sem_chave" }
  }
  if (!params.pergunta?.trim()) {
    return { ok: false, motivo: "falhou" }
  }

  const client = new Anthropic()

  const historico = (params.historico ?? []).slice(-LIMITE_HISTORICO).map(
    (m) => ({
      role: (m.autor === "pessoa" ? "user" : "assistant") as "user" | "assistant",
      content: m.texto,
    })
  )

  try {
    const resposta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 1536,
      // O previdenciário fala de doença, morte e prisão o tempo todo; o
      // fallback evita que um falso positivo recuse uma conversa legítima.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: instrucoes(params.nomeUsuario),
      messages: [...historico, { role: "user", content: params.pergunta.trim() }],
    })

    if (resposta.stop_reason === "refusal") {
      return { ok: false, motivo: "recusado" }
    }

    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim()

    if (!texto) return { ok: false, motivo: "falhou" }

    return { ok: true, resposta: texto, modelo: resposta.model ?? MODELO }
  } catch (erro) {
    console.error("Agente do escritório:", erro)
    return { ok: false, motivo: "falhou" }
  }
}
