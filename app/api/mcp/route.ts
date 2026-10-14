import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

import { chaveDoPedido, usuarioDaChave } from "@/lib/chaves"
import { servidorDoClaude } from "@/lib/mcp/servidor"

/**
 * O conector do Claude (MCP, transporte "Streamable HTTP").
 *
 * É adicionado no Claude como conector personalizado, com o endereço
 * desta rota e o cabeçalho "Authorization: Bearer <chave>" — a chave
 * gerada em Configurações › Conectar o Claude. Sem chave válida, nada
 * responde: nem a lista de ferramentas.
 *
 * Sem sessão guardada no servidor (modo "stateless"): cada pedido monta
 * o servidor de novo, em nome da conta dona da chave. Na Vercel cada
 * pedido pode cair numa máquina diferente, e assim nenhum depende do
 * anterior. As respostas vêm em JSON, sem stream: as ferramentas daqui
 * respondem de uma vez.
 */

function negado(status: number, mensagem: string) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message: mensagem }, id: null },
    { status }
  )
}

async function atender(request: Request) {
  const usuario = await usuarioDaChave(chaveDoPedido(request))
  if (!usuario) {
    return negado(401, "Chave ausente, inválida ou revogada. Gere uma em Configurações › Conectar o Claude.")
  }

  const transporte = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  const servidor = servidorDoClaude(usuario)
  await servidor.connect(transporte)

  try {
    return await transporte.handleRequest(request)
  } finally {
    // A resposta JSON já está pronta; o servidor deste pedido acabou.
    void servidor.close().catch(() => {})
  }
}

export const POST = atender

/**
 * Sem sessão no servidor, não há stream para abrir (GET) nem sessão
 * para encerrar (DELETE): a especificação manda responder 405, e o
 * cliente segue só com POST.
 */
function soPost() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } })
}

export const GET = soPost
export const DELETE = soPost
