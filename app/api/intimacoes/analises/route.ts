import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { analisarIntimacoes } from "@/lib/intimacoes/analisar"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Triagem por IA — uma intimação (com `id`) ou o lote das que ainda
 * não foram lidas.
 *
 * Sem `ANTHROPIC_API_KEY` a resposta diz isso em vez de estourar: a
 * tela toda continua funcionando sem IA, só sem o resumo.
 */
const AnaliseSchema = z.object({
  id: z.string().optional(),
  limite: z.number().int().min(1).max(50).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const parsed = AnaliseSchema.safeParse(await request.json().catch(() => ({})))

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    let consulta = supabase
      .from("comunicacoes_djen")
      .select("id, texto, tipo_documento, nome_orgao, nome_classe")
      .in("user_id", await idsDoEscritorio())

    if (parsed.data.id) {
      // Reanalisar uma já lida é legítimo: o texto pode ter sido
      // truncado, ou o modelo mudou.
      consulta = consulta.eq("id", parsed.data.id)
    } else {
      consulta = consulta
        .is("ia_analisada_em", null)
        .is("tratada_em", null)
        .order("data_disponibilizacao", { ascending: false })
        .limit(parsed.data.limite ?? 30)
    }

    const { data, error } = await consulta

    if (error) {
      console.error("Buscar para análise:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    const resultado = await analisarIntimacoes(
      user.id,
      data ?? [],
      parsed.data.limite ?? 30
    )

    if (resultado.semChave) {
      return NextResponse.json(
        {
          error:
            "IA não configurada: falta ANTHROPIC_API_KEY no ambiente. O resto da tela funciona normalmente.",
          ...resultado,
        },
        { status: 503 }
      )
    }

    // A análise volta junto para o cartão não precisar recarregar.
    const { data: atualizadas } = await supabase
      .from("comunicacoes_djen")
      .select(
        "id, ia_tipo_ato, ia_resumo, ia_providencia, ia_urgencia, ia_prazo_de_quem, ia_alertas, ia_analisada_em"
      )
      .in("user_id", await idsDoEscritorio())
      .in("id", (data ?? []).map((d) => d.id))

    return NextResponse.json(
      { ...resultado, intimacoes: atualizadas ?? [] },
      { status: 200 }
    )
  } catch (error) {
    console.error("Análise de intimações:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
