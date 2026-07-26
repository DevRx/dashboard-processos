import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { expurgarImportacoesVencidas } from "@/lib/lgpd/retencao"
import { ipDaRequisicao, registrarTratamento } from "@/lib/lgpd/auditoria"

/**
 * Expurgo por término do prazo de retenção (art. 15, I).
 *
 * Dois modos de acionamento:
 *
 * - Cron: header `x-cron-secret` igual a `LGPD_CRON_SECRET`. Expurga
 *   todos os usuários. É o modo que faz a retenção realmente
 *   acontecer — política de retenção que depende de alguém clicar não
 *   é política.
 * - Manual: usuário autenticado, restrito aos próprios dados.
 *
 * Se `LGPD_CRON_SECRET` não estiver configurada, o modo cron fica
 * indisponível em vez de liberar acesso — falha fechada.
 */
export async function POST(request: NextRequest) {
  try {
    const segredoConfigurado = process.env.LGPD_CRON_SECRET
    const segredoRecebido = request.headers.get("x-cron-secret")
    const viaCron = Boolean(
      segredoConfigurado && segredoRecebido === segredoConfigurado
    )

    if (viaCron) {
      const resultado = await expurgarImportacoesVencidas()
      return NextResponse.json(
        { message: "Expurgo executado", ...resultado },
        { status: resultado.erro ? 500 : 200 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const resultado = await expurgarImportacoesVencidas(user.id)

    if (resultado.erro) {
      return NextResponse.json(
        { error: "Não foi possível executar o expurgo" },
        { status: 500 }
      )
    }

    await registrarTratamento({
      userId: user.id,
      acao: "RETENCAO_EXPURGADA",
      entidade: "importacao_integracao",
      detalhes: { expurgadas: resultado.expurgadas },
      ip: ipDaRequisicao(request),
    })

    return NextResponse.json(
      {
        message:
          resultado.expurgadas > 0
            ? `${resultado.expurgadas} importação(ões) expurgada(s) por término da retenção`
            : "Nenhuma importação com retenção vencida",
        expurgadas: resultado.expurgadas,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Expurgo retenção error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
