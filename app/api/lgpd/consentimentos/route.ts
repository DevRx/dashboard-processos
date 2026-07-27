import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { ConsentimentoSchema } from "@/lib/validators"
import { listarConsentimentos } from "@/lib/lgpd/consentimento"
import { ipDaRequisicao, registrarTratamento } from "@/lib/lgpd/auditoria"

/**
 * Base legal por titular.
 *
 * GET  /api/lgpd/consentimentos?clienteId=…  histórico completo
 * POST /api/lgpd/consentimentos              registra nova base legal
 *
 * O histórico inclui os revogados de propósito: apagá-los destruiria
 * a prova de que o tratamento anterior tinha fundamento.
 */

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const clienteId = new URL(request.url).searchParams.get("clienteId")
    if (!clienteId) {
      return NextResponse.json({ error: "Informe o cliente" }, { status: 400 })
    }

    const consentimentos = await listarConsentimentos(clienteId, user.id)
    return NextResponse.json({ consentimentos }, { status: 200 })
  } catch (error) {
    console.error("Get consentimentos error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const validado = ConsentimentoSchema.safeParse(body)

    if (!validado.success) {
      const primeiro = validado.error.issues[0]
      return NextResponse.json(
        { error: primeiro?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const {
      clienteId,
      baseLegal,
      finalidade,
      procuracaoRef,
      fontes,
      iaAutorizada,
      retencaoAte,
    } = validado.data

    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", clienteId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    const { data: consentimento, error } = await supabase
      .from("consentimentos_lgpd")
      .insert({
        user_id: user.id,
        cliente_id: clienteId,
        base_legal: baseLegal,
        finalidade,
        procuracao_ref: procuracaoRef ?? null,
        fontes,
        ia_autorizada: iaAutorizada,
        retencao_ate: retencaoAte ?? null,
      })
      .select()
      .single()

    if (error || !consentimento) {
      // O índice único parcial garante um só consentimento vigente por
      // cliente: substituir a base legal exige revogar a anterior, o
      // que preserva a linha do tempo do tratamento.
      if (error?.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Este cliente já tem base legal vigente. Revogue a atual antes de registrar outra.",
          },
          { status: 409 }
        )
      }
      console.error("Create consentimento error:", error?.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    await registrarTratamento({
      userId: user.id,
      acao: "BASE_LEGAL_REGISTRADA",
      entidade: "consentimento_lgpd",
      entidadeId: consentimento.id,
      detalhes: { baseLegal, fontes: fontes.join(","), retencaoAte },
      ip: ipDaRequisicao(request),
    })

    return NextResponse.json(
      {
        message: "Base legal registrada",
        consentimento: toCamelCase(consentimento),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create consentimento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
