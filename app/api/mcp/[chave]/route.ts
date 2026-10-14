import { chaveDoPedido } from "@/lib/chaves"
import { atenderConector, soPost } from "@/lib/mcp/rota"

/**
 * O conector do Claude com a chave no endereço: /api/mcp/<chave>. É o
 * que vai no campo URL do conector personalizado, com "sem login" — ver
 * lib/mcp/rota.ts. Se o cliente mandar também o cabeçalho, vale o do
 * endereço.
 */
export async function POST(request: Request, { params }: { params: Promise<{ chave: string }> }) {
  const { chave } = await params
  return atenderConector(request, decodeURIComponent(chave) || chaveDoPedido(request))
}

export const GET = soPost
export const DELETE = soPost
