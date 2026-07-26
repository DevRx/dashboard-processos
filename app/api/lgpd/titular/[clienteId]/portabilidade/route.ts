import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { listarConsentimentos } from "@/lib/lgpd/consentimento"
import { ipDaRequisicao, registrarTratamento } from "@/lib/lgpd/auditoria"

/**
 * Acesso e portabilidade (art. 18, II e V).
 *
 * Devolve, em JSON legível, tudo o que o sistema guarda sobre o
 * titular: cadastro, processos, andamentos, importações do INSS e a
 * própria trilha de base legal. Formato estruturado e de uso comum é
 * requisito da portabilidade — PDF de tela não cumpre.
 *
 * Aqui os dados vão completos, sem mascaramento: o destinatário é o
 * próprio titular, e entregar CPF mascarado a quem é dono do CPF
 * frustraria o direito.
 */
export async function GET(
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
      .select("*")
      .eq("id", clienteId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    const [{ data: processos }, { data: importacoes }, consentimentos] =
      await Promise.all([
        supabase
          .from("processos")
          .select("*, andamentos(*), documentos(nome, tipo, created_at)")
          .eq("cliente_id", clienteId)
          .eq("user_id", user.id),
        supabase
          .from("importacoes_integracao")
          .select("*")
          .eq("cliente_id", clienteId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        listarConsentimentos(clienteId, user.id),
      ])

    await registrarTratamento({
      userId: user.id,
      acao: "PORTABILIDADE_EXPORTADA",
      entidade: "cliente",
      entidadeId: clienteId,
      detalhes: {
        processos: processos?.length ?? 0,
        importacoes: importacoes?.length ?? 0,
      },
      ip: ipDaRequisicao(request),
    })

    const dossie = {
      geradoEm: new Date().toISOString(),
      // O titular tem direito de saber a quem reclamar e com que
      // fundamento seus dados foram tratados (art. 9º).
      controlador: { usuarioResponsavelId: user.id, nome: user.name },
      titular: toCamelCase(cliente),
      basesLegais: consentimentos,
      processos: toCamelCase(processos ?? []),
      importacoesInss: toCamelCase(importacoes ?? []),
    }

    return new NextResponse(JSON.stringify(dossie, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dados-titular-${clienteId}.json"`,
      },
    })
  } catch (error) {
    console.error("Portabilidade error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
