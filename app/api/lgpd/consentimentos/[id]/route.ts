import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { RevogacaoSchema } from "@/lib/validators"
import { ipDaRequisicao, registrarTratamento } from "@/lib/lgpd/auditoria"

/**
 * Revogação da base legal (art. 8º, §5º).
 *
 * DELETE marca `revogado_em` em vez de apagar a linha. A partir daí a
 * rota de importação recusa novos dados para o titular, mas o registro
 * de que existiu base legal — e de quando deixou de existir —
 * permanece. É essa linha do tempo que demonstra conformidade.
 *
 * Revogar não elimina o que já foi importado: para isso existe
 * DELETE /api/lgpd/titular/[clienteId].
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const validado = RevogacaoSchema.safeParse(body)

    if (!validado.success) {
      const primeiro = validado.error.issues[0]
      return NextResponse.json(
        { error: primeiro?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { data: consentimento, error } = await supabase
      .from("consentimentos_lgpd")
      .update({
        revogado_em: new Date().toISOString(),
        revogado_motivo: validado.data.motivo,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("revogado_em", null)
      .select()
      .maybeSingle()

    if (error) {
      console.error("Revogar consentimento error:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    if (!consentimento) {
      return NextResponse.json(
        { error: "Base legal não encontrada ou já revogada" },
        { status: 404 }
      )
    }

    await registrarTratamento({
      userId: user.id,
      acao: "BASE_LEGAL_REVOGADA",
      entidade: "consentimento_lgpd",
      entidadeId: id,
      detalhes: { motivo: validado.data.motivo },
      ip: ipDaRequisicao(request),
    })

    return NextResponse.json(
      {
        message: "Base legal revogada",
        consentimento: toCamelCase(consentimento),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Revogar consentimento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
