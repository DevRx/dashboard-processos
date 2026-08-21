import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Visão geral da integração INSS por cliente.
 *
 * Existe para a integração ter um lugar no produto. Antes, o painel só
 * vivia dentro do detalhe de um cliente: para usar a integração era
 * preciso lembrar que ela existia e ir cavar. O que interessa numa
 * lista é o que está pendente de ação — documento importado e ainda
 * não aplicado, e retenção perto de vencer.
 */

/** Retenção vencendo dentro desta janela entra como alerta. */
const DIAS_ALERTA_RETENCAO = 30

type ConsentimentoBruto = {
  id: string
  base_legal: string
  fontes: string[] | null
  retencao_ate: string | null
  revogado_em: string | null
}

type ImportacaoBruta = {
  id: string
  documento: string | null
  processo_id: string | null
  expurgado_em: string | null
  created_at: string
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("clientes")
      .select(
        "id, nome, consentimentos_lgpd(id, base_legal, fontes, retencao_ate, revogado_em), importacoes_integracao(id, documento, processo_id, expurgado_em, created_at)"
      )
      .in("user_id", await idsDoEscritorio())
      .order("nome")

    if (error) {
      console.error("Painel integrações error:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    const hoje = new Date().toISOString().slice(0, 10)
    const limiteAlerta = new Date(Date.now() + DIAS_ALERTA_RETENCAO * 86_400_000)
      .toISOString()
      .slice(0, 10)

    const clientes = (data ?? []).map((c) => {
      const consentimentos = (c.consentimentos_lgpd ??
        []) as ConsentimentoBruto[]
      const importacoes = (c.importacoes_integracao ?? []) as ImportacaoBruta[]

      const vigente = consentimentos.find((x) => !x.revogado_em) ?? null
      const ativas = importacoes.filter((i) => !i.expurgado_em)

      return {
        id: c.id,
        nome: c.nome,
        baseLegal: vigente?.base_legal ?? null,
        fontes: vigente?.fontes ?? [],
        retencaoAte: vigente?.retencao_ate ?? null,
        retencaoVencida: Boolean(
          vigente?.retencao_ate && vigente.retencao_ate < hoje
        ),
        retencaoVencendo: Boolean(
          vigente?.retencao_ate &&
            vigente.retencao_ate >= hoje &&
            vigente.retencao_ate <= limiteAlerta
        ),
        importadas: ativas.length,
        // Importação sem processo vinculado é trabalho parado: o
        // documento foi lido mas nada entrou no processo.
        pendentesAplicacao: ativas.filter((i) => !i.processo_id).length,
        ultimaImportacao:
          ativas
            .map((i) => i.created_at)
            .sort()
            .at(-1) ?? null,
      }
    })

    return NextResponse.json(
      {
        clientes,
        resumo: {
          comBaseLegal: clientes.filter((c) => c.baseLegal).length,
          semBaseLegal: clientes.filter((c) => !c.baseLegal).length,
          pendentesAplicacao: clientes.reduce(
            (t, c) => t + c.pendentesAplicacao,
            0
          ),
          retencaoEmRisco: clientes.filter(
            (c) => c.retencaoVencida || c.retencaoVencendo
          ).length,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Painel integrações error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
