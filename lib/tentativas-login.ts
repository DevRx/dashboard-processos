import "server-only"
import { supabase } from "@/lib/supabase/server"

/**
 * Limite de tentativas no login (tabela `tentativas_login`, migration
 * 20261015030000).
 *
 * Cada senha errada vira uma linha com o e-mail e o endereço de origem.
 * A partir da 5ª em 15 minutos — pelo e-mail OU pelo endereço — o
 * login responde 429 antes de conferir a senha, que é a parte cara
 * (bcrypt). Acertar a senha apaga as linhas daquele e-mail.
 *
 * É tabela, e não memória, porque na Vercel cada pedido pode cair numa
 * função diferente, e um limite que só uma delas conhece não limita.
 * Sem a migration, a tabela não existe e o login segue como antes.
 */

export const LIMITE = 5
export const JANELA_MIN = 15

function semTabela(erro?: { code?: string | null; message?: string | null } | null) {
  return erro?.code === "42P01" || erro?.code === "PGRST205" || /tentativas_login/.test(erro?.message ?? "")
}

/** Quantas falhas recentes por e-mail e por endereço; `null` se a tabela não existe. */
export async function falhasRecentes(email: string, ip: string | null): Promise<{ email: number; ip: number; proximaEm: Date | null } | null> {
  const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString()
  const { data, error } = await supabase
    .from("tentativas_login")
    .select("email, ip, quando")
    .gte("quando", desde)
    .or(`email.eq.${email.replace(/[,()]/g, "")}${ip ? `,ip.eq.${ip.replace(/[,()]/g, "")}` : ""}`)
    .order("quando", { ascending: true })
    .limit(200)

  if (error) {
    if (!semTabela(error)) console.error("Tentativas de login:", error.message)
    return null
  }
  const linhas = (data ?? []) as { email: string; ip: string | null; quando: string }[]
  const doEmail = linhas.filter((l) => l.email === email)
  const doIp = ip ? linhas.filter((l) => l.ip === ip) : []
  // O bloqueio acaba quando a tentativa mais antiga da janela sai dela.
  const bloqueadoras = doEmail.length >= LIMITE ? doEmail : doIp.length >= LIMITE ? doIp : []
  const proximaEm = bloqueadoras.length ? new Date(new Date(bloqueadoras[bloqueadoras.length - LIMITE].quando).getTime() + JANELA_MIN * 60_000) : null
  return { email: doEmail.length, ip: doIp.length, proximaEm }
}

export async function registrarFalha(email: string, ip: string | null) {
  const { error } = await supabase.from("tentativas_login").insert({ email, ip })
  if (error && !semTabela(error)) console.error("Registrar tentativa de login:", error.message)
  // Faxina ocasional: nada com mais de um dia interessa.
  if (Math.random() < 0.05) {
    await supabase.from("tentativas_login").delete().lt("quando", new Date(Date.now() - 86_400_000).toISOString())
  }
}

export async function limparFalhas(email: string) {
  const { error } = await supabase.from("tentativas_login").delete().eq("email", email)
  if (error && !semTabela(error)) console.error("Limpar tentativas de login:", error.message)
}

/** O endereço de quem pediu, pelo cabeçalho que a Vercel (ou outro proxy) põe. */
export function ipDoPedido(request: Request): string | null {
  const enc = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? ""
  const primeiro = enc.split(",")[0]?.trim()
  return primeiro ? primeiro.slice(0, 64) : null
}
