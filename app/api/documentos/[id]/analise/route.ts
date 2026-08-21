import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { mensagemWhatsApp } from "@/lib/ia/mensagem-triagem"
import type { LeituraDocumento } from "@/lib/ia/leitor-documento"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Triagem de um documento, em forma consumível por automação.
 *
 * Devolve os campos estruturados e a mesma triagem já formatada em
 * texto para WhatsApp — o n8n encaminha `mensagem` sem precisar montar
 * template nenhum. Manter a formatação aqui e não no fluxo evita que a
 * mensagem apodreça: mudou a extração, o texto acompanha.
 *
 * A leitura já foi feita e gravada no upload; este endpoint não chama
 * a IA. Reler a cada consulta mandaria o mesmo dado sensível para fora
 * repetidamente, sem ganho.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const { data: documento } = await supabase
      .from("documentos")
      .select(
        "id, nome, categoria, ia_resumo, ia_campos, ia_lido_em, ia_modelo, cliente:clientes(nome)"
      )
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .maybeSingle()

    if (!documento) {
      return NextResponse.json(
        { error: "Documento não encontrado" },
        { status: 404 }
      )
    }

    if (!documento.ia_lido_em || !documento.ia_campos) {
      return NextResponse.json(
        {
          error:
            "Este documento não passou por triagem. Só laudo médico, com autorização de IA do titular, é lido.",
        },
        { status: 409 }
      )
    }

    const analise = documento.ia_campos as {
      triagem: LeituraDocumento["triagem"]
      validade: LeituraDocumento["validade"]
      pontosFracos: string[]
      beneficioSugerido?: string
      ilegivel: string[]
    }

    const cliente = documento.cliente as { nome?: string } | null

    const leitura: LeituraDocumento = {
      categoria: documento.categoria,
      resumo: documento.ia_resumo ?? "",
      triagem: analise.triagem,
      validade: analise.validade,
      pontosFracos: analise.pontosFracos ?? [],
      beneficioSugerido: analise.beneficioSugerido,
      ilegivel: analise.ilegivel ?? [],
      modelo: documento.ia_modelo ?? "",
    }

    return NextResponse.json(
      {
        documento: {
          id: documento.id,
          nome: documento.nome,
          categoria: documento.categoria,
          lidoEm: documento.ia_lido_em,
          modelo: documento.ia_modelo,
        },
        cliente: cliente?.nome ?? null,
        resumo: documento.ia_resumo,
        triagem: analise.triagem,
        validade: analise.validade,
        pontosFracos: analise.pontosFracos ?? [],
        beneficioSugerido: analise.beneficioSugerido ?? null,
        ilegivel: analise.ilegivel ?? [],
        // Pronto para encaminhar. O nome do cliente entra aqui, do
        // cadastro — a triagem em si nunca o carrega.
        mensagem: mensagemWhatsApp(leitura, {
          cliente: cliente?.nome,
          arquivo: documento.nome,
        }),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Análise de documento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
