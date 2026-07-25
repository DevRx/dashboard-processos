import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { consultarProcessoDataJud } from "@/lib/datajud"

const MOTIVO_MENSAGEM: Record<string, string> = {
  invalid_format:
    "Número inválido. Use o padrão CNJ com 20 dígitos (ex: 0000000-00.0000.0.00.0000).",
  unsupported_court:
    "Este número não é da Justiça Federal (TRF1 a TRF6) — a busca automática só cobre esses tribunais por enquanto.",
  datajud_error: "Não foi possível consultar o DataJud agora. Tente novamente.",
  not_found: "Processo não encontrado na base do DataJud.",
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const numero = searchParams.get("numero")

    if (!numero) {
      return NextResponse.json(
        { error: "Informe o número do processo" },
        { status: 400 }
      )
    }

    const resultado = await consultarProcessoDataJud(numero)

    if (!resultado.ok) {
      return NextResponse.json(
        { error: MOTIVO_MENSAGEM[resultado.motivo] || "Não foi possível buscar o processo" },
        { status: resultado.motivo === "not_found" ? 404 : 400 }
      )
    }

    return NextResponse.json({ dados: resultado.dados }, { status: 200 })
  } catch (error) {
    console.error("Datajud lookup error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
