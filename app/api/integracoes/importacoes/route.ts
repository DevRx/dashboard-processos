import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Histórico de importações de um cliente.
 *
 * Inclui as expurgadas, com `dados` já vazio: a linha continua
 * visível para o operador entender que houve importação e que ela foi
 * eliminada — o registro de tratamento sobrevive ao dado tratado.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get("clienteId")

    if (!clienteId) {
      return NextResponse.json({ error: "Informe o cliente" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("importacoes_integracao")
      .select("*")
      .eq("cliente_id", clienteId)
      .in("user_id", await idsDoEscritorio())
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Get importações error:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { importacoes: toCamelCase(data ?? []) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get importações error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
