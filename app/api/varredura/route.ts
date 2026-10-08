import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Dados da Central do INSS — varredura.
 *
 * Lê os clientes do escritório que têm forma de acesso definida
 * (clientes.acesso_inss) e junta a última leitura de cada um
 * (varredura_leituras). Precisa da migração 20261008_varredura_inss.
 *
 * Degrada de propósito: sem a migração, sem clientes marcados, ou
 * qualquer erro → responde `exemplo: true` com lista vazia, e a tela
 * mostra os dados de exemplo em vez de quebrar. Quando houver dado
 * real, devolve `exemplo: false` e os itens de verdade.
 *
 * CPF sai mascarado (3 últimos dígitos) — a identificação no sistema é
 * o id do cliente, não o CPF.
 */

function mascararCpf(cpf: string | null): string {
  const d = (cpf ?? "").replace(/\D/g, "")
  if (d.length !== 11) return "—"
  return `***.***.${d.slice(6, 9)}-**`
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const ids = await idsDoEscritorio()

    const { data: clientes, error } = await supabase
      .from("clientes")
      .select("id, nome, cpf, acesso_inss")
      .in("user_id", ids)
      .not("acesso_inss", "is", null)

    if (error || !clientes || clientes.length === 0) {
      return NextResponse.json({ itens: [], exemplo: true }, { status: 200 })
    }

    const { data: leituras } = await supabase
      .from("varredura_leituras")
      .select("cliente_id, lida_em, situacao, resumo")
      .in("user_id", ids)
      .order("lida_em", { ascending: false })

    const ultima = new Map<
      string,
      { lida_em: string; situacao: string; resumo: string | null }
    >()
    for (const l of leituras ?? []) {
      if (!ultima.has(l.cliente_id)) ultima.set(l.cliente_id, l)
    }

    const itens = clientes.map((c) => {
      const l = ultima.get(c.id)
      return {
        id: c.id,
        nome: c.nome,
        cpf: mascararCpf(c.cpf),
        beneficio: "—",
        acesso: c.acesso_inss,
        situacao: l?.situacao ?? "OK",
        ultimaLeitura: l?.lida_em ? l.lida_em.slice(0, 10) : null,
        mudanca: l?.resumo ?? null,
      }
    })

    return NextResponse.json({ itens, exemplo: false }, { status: 200 })
  } catch (erro) {
    console.error("Varredura:", erro)
    return NextResponse.json({ itens: [], exemplo: true }, { status: 200 })
  }
}
