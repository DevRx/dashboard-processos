import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { ConsentimentoEdicaoSchema, RevogacaoSchema } from "@/lib/validators"
import { ipDaRequisicao, registrarTratamento } from "@/lib/lgpd/auditoria"

/**
 * Retificação da base legal vigente.
 *
 * Duas estratégias, escolhidas pelo histórico e não por preferência:
 *
 * - Nenhuma importação sob esta base legal → atualiza no lugar. Nada
 *   foi tratado sob ela, então não existe trilha a proteger: é uma
 *   correção de cadastro.
 * - Já houve importação → substitui. A base antiga é revogada com
 *   motivo de retificação e uma nova entra em vigor. Sobrescrever
 *   apagaria qual era a base legal no momento em que o dado sensível
 *   foi tratado, que é justamente o que se precisa demonstrar depois.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validado = ConsentimentoEdicaoSchema.safeParse(body)

    if (!validado.success) {
      const primeiro = validado.error.issues[0]
      return NextResponse.json(
        { error: primeiro?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { baseLegal, finalidade, procuracaoRef, fontes, retencaoAte } =
      validado.data

    const { data: atual } = await supabase
      .from("consentimentos_lgpd")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("revogado_em", null)
      .maybeSingle()

    if (!atual) {
      return NextResponse.json(
        { error: "Base legal não encontrada ou já revogada" },
        { status: 404 }
      )
    }

    const campos = {
      base_legal: baseLegal,
      finalidade,
      procuracao_ref: procuracaoRef ?? null,
      fontes,
      retencao_ate: retencaoAte ?? null,
    }

    const { count } = await supabase
      .from("importacoes_integracao")
      .select("id", { count: "exact", head: true })
      .eq("consentimento_id", id)
      .is("expurgado_em", null)

    const houveTratamento = (count ?? 0) > 0

    if (!houveTratamento) {
      const { data: corrigido, error } = await supabase
        .from("consentimentos_lgpd")
        .update(campos)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single()

      if (error || !corrigido) {
        console.error("Retificar base legal:", error?.message)
        return NextResponse.json(
          { error: "Erro interno do servidor" },
          { status: 500 }
        )
      }

      await registrarTratamento({
        userId: user.id,
        acao: "BASE_LEGAL_RETIFICADA",
        entidade: "consentimento_lgpd",
        entidadeId: id,
        detalhes: { baseLegal, fontes: fontes.join(","), retencaoAte },
        ip: ipDaRequisicao(request),
      })

      return NextResponse.json(
        { message: "Base legal corrigida", consentimento: toCamelCase(corrigido) },
        { status: 200 }
      )
    }

    // Substituição. A revogação vem primeiro porque o índice único
    // parcial admite uma só base legal vigente por cliente.
    const { error: erroRevogacao } = await supabase
      .from("consentimentos_lgpd")
      .update({
        revogado_em: new Date().toISOString(),
        revogado_motivo: "Substituída por retificação da base legal",
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("revogado_em", null)

    if (erroRevogacao) {
      console.error("Substituir base legal — revogação:", erroRevogacao.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    const { data: nova, error: erroInsercao } = await supabase
      .from("consentimentos_lgpd")
      .insert({ user_id: user.id, cliente_id: atual.cliente_id, ...campos })
      .select()
      .single()

    if (erroInsercao || !nova) {
      // Sem transação no cliente REST: se a inserção falha, desfaz a
      // revogação. Deixar o cliente sem base legal vigente bloquearia
      // a importação por um erro nosso, não por decisão do titular.
      await supabase
        .from("consentimentos_lgpd")
        .update({ revogado_em: null, revogado_motivo: null })
        .eq("id", id)
        .eq("user_id", user.id)

      console.error("Substituir base legal — inserção:", erroInsercao?.message)
      return NextResponse.json(
        { error: "Não foi possível substituir a base legal" },
        { status: 500 }
      )
    }

    await registrarTratamento({
      userId: user.id,
      acao: "BASE_LEGAL_SUBSTITUIDA",
      entidade: "consentimento_lgpd",
      entidadeId: nova.id,
      detalhes: {
        substituiu: id,
        baseLegal,
        fontes: fontes.join(","),
        importacoesSobBaseAnterior: count ?? 0,
      },
      ip: ipDaRequisicao(request),
    })

    return NextResponse.json(
      {
        message:
          "Base legal substituída. A anterior fica no histórico, porque houve importação sob ela.",
        consentimento: toCamelCase(nova),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Retificar base legal error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

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
