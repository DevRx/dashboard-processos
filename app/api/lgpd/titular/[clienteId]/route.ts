import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { eliminarDadosImportados } from "@/lib/lgpd/retencao"
import { ipDaRequisicao, registrarTratamento } from "@/lib/lgpd/auditoria"

/**
 * Eliminação a pedido do titular (art. 18, VI).
 *
 * Escopo: os dados que a integração trouxe do INSS. Cliente,
 * processos e documentos do mandato permanecem — guarda de documentos
 * do processo e prazo prescricional são obrigação legal do advogado, o
 * que é a exceção expressa do art. 16, I. Apagar o processo a pedido
 * do titular prejudicaria o próprio titular numa futura revisão, e é
 * por isso que a resposta declara o que ficou e por quê, em vez de
 * silenciar sobre isso.
 *
 * A base legal também é revogada na mesma operação: manter base legal
 * vigente depois de o titular pedir eliminação permitiria reimportar
 * tudo no minuto seguinte.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { clienteId } = await params

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

    const resultado = await eliminarDadosImportados(clienteId, user.id)

    if (resultado.erro) {
      return NextResponse.json(
        { error: "Não foi possível concluir a eliminação" },
        { status: 500 }
      )
    }

    await supabase
      .from("consentimentos_lgpd")
      .update({
        revogado_em: new Date().toISOString(),
        revogado_motivo: "Eliminação solicitada pelo titular (art. 18, VI)",
      })
      .eq("cliente_id", clienteId)
      .eq("user_id", user.id)
      .is("revogado_em", null)

    await registrarTratamento({
      userId: user.id,
      acao: "TITULAR_ELIMINADO",
      entidade: "cliente",
      entidadeId: clienteId,
      detalhes: { importacoesEliminadas: resultado.expurgadas },
      ip: ipDaRequisicao(request),
    })

    return NextResponse.json(
      {
        message: "Dados importados do INSS eliminados e base legal revogada",
        importacoesEliminadas: resultado.expurgadas,
        retido: {
          motivo:
            "Processos, andamentos e documentos do mandato são retidos por obrigação legal do advogado (LGPD art. 16, I).",
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Eliminação titular error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
