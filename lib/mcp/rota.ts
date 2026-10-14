import "server-only"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

import { usuarioDaChave } from "@/lib/chaves"
import { servidorDoClaude } from "@/lib/mcp/servidor"

/**
 * Atende um pedido do conector do Claude (MCP, Streamable HTTP, sem
 * sessão no servidor), em nome da conta dona da chave.
 *
 * A chave chega de dois jeitos (ver as rotas em app/api/mcp):
 *  - no endereço: /api/mcp/<chave> — o jeito recomendado. O Claude, ao
 *    adicionar um conector, testa o endereço SEM cabeçalho nenhum; com
 *    a chave no endereço o teste já passa, e ele entende que o conector
 *    não precisa de login. Com a chave só no cabeçalho, o teste levava
 *    401 e o Claude tentava um login OAuth que o sistema não tem
 *    ("Não foi possível registrar no serviço de login").
 *  - no cabeçalho "Authorization: Bearer <chave>", para clientes que
 *    mandam o cabeçalho desde o primeiro pedido.
 *
 * O endereço com a chave vale como senha: quem o tiver usa o conector.
 * Revogar a chave em Configurações › Conectar o Claude corta na hora.
 */
export async function atenderConector(request: Request, chave: string | null) {
  const usuario = await usuarioDaChave(chave)
  if (!usuario) {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: "Chave ausente, inválida ou revogada. Gere uma em Configurações › Conectar o Claude." },
        id: null,
      },
      { status: 401 }
    )
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

/**
 * Sem sessão no servidor, não há stream para abrir (GET) nem sessão
 * para encerrar (DELETE): a especificação manda responder 405, e o
 * cliente segue só com POST.
 */
export function soPost() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } })
}
