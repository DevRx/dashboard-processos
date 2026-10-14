import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { gravarConfiguracao, isChaveConfiguracao, todasConfiguracoes } from "@/lib/configuracoes"

/**
 * Configurações do escritório (ver lib/configuracoes.ts).
 *
 * Qualquer um da equipe lê; só o administrador grava. A mudança fica
 * na auditoria com quem ligou e quando — uma trava de envio ao cliente
 * não pode mudar sem rastro.
 */

const Gravar = z.object({
  chave: z.string().min(1),
  valor: z.union([z.boolean(), z.string(), z.number()]),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  return NextResponse.json({ configuracoes: await todasConfiguracoes() })
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Só o administrador muda configurações" }, { status: 403 })

  const parsed = Gravar.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isChaveConfiguracao(parsed.data.chave)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  }

  const r = await gravarConfiguracao(parsed.data.chave, parsed.data.valor, user.id)
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 503 })

  const { error } = await supabase.from("auditorias").insert({
    user_id: user.id,
    acao: "CONFIGURACAO_ALTERADA",
    entidade: "configuracao",
    detalhes: { chave: parsed.data.chave, valor: parsed.data.valor },
  })
  if (error) console.error("Auditoria da configuração:", error.message)

  return NextResponse.json({ configuracoes: await todasConfiguracoes() })
}
