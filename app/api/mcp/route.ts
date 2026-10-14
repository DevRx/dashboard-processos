import { chaveDoPedido } from "@/lib/chaves"
import { atenderConector, soPost } from "@/lib/mcp/rota"

/**
 * O conector do Claude com a chave no cabeçalho
 * "Authorization: Bearer <chave>". O jeito recomendado é o endereço com
 * a chave, /api/mcp/<chave> — ver lib/mcp/rota.ts.
 */
export async function POST(request: Request) {
  return atenderConector(request, chaveDoPedido(request))
}

export const GET = soPost
export const DELETE = soPost
