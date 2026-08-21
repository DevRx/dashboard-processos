import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { AplicarImportacaoSchema } from "@/lib/validators"
import { derivarAplicacao } from "@/lib/integracoes/aplicar"
import type { DocumentoINSS } from "@/lib/integracoes/contrato"
import { ipDaRequisicao, registrarTratamento } from "@/lib/lgpd/auditoria"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Aplica ao processo o que foi extraído de um documento importado.
 *
 * A derivação é a mesma que a UI mostrou na prévia
 * (`derivarAplicacao`), e só os campos confirmados pelo operador são
 * gravados. O andamento é sempre gravado com o status resultante, de
 * modo que o histórico do processo mostre de onde a mudança veio — um
 * status que muda sozinho, sem andamento correspondente, é o tipo de
 * coisa que ninguém consegue explicar seis meses depois.
 *
 * Com `criarRequerimento`, o documento abre o caso: cria um processo
 * na esfera administrativa, identificado pelo protocolo do INSS. É o
 * inverso da ordem antiga, que exigia um processo judicial — com
 * número CNJ — para poder registrar um requerimento que ainda nem saiu
 * do administrativo.
 */
export async function POST(
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
    const validado = AplicarImportacaoSchema.safeParse(body)

    if (!validado.success) {
      const primeiro = validado.error.issues[0]
      return NextResponse.json(
        { error: primeiro?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const confirmado = validado.data

    const { data: importacao } = await supabase
      .from("importacoes_integracao")
      .select("*")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .maybeSingle()

    if (!importacao) {
      return NextResponse.json(
        { error: "Importação não encontrada" },
        { status: 404 }
      )
    }

    // Importação expurgada não tem mais conteúdo: o dado foi eliminado
    // por retenção ou a pedido do titular, e reaplicá-lo ressuscitaria
    // dado que deveria estar fora do sistema.
    if (importacao.expurgado_em) {
      return NextResponse.json(
        {
          error:
            "Esta importação foi eliminada por término de retenção ou a pedido do titular. Importe o documento novamente se ainda houver base legal.",
        },
        { status: 409 }
      )
    }

    if (!importacao.documento) {
      return NextResponse.json(
        { error: "Importação sem tipo de documento identificado" },
        { status: 422 }
      )
    }

    const proposta = derivarAplicacao(
      importacao.documento as DocumentoINSS,
      (importacao.dados ?? {}) as Record<string, unknown>
    )

    const hoje = new Date().toISOString().slice(0, 10)
    const aplicado: string[] = []

    type ProcessoDestino = {
      id: string
      cliente_id: string
      status: string
      beneficio: string
    }
    let processo: ProcessoDestino

    if (confirmado.criarRequerimento) {
      if (!importacao.cliente_id) {
        return NextResponse.json(
          { error: "Importação sem cliente — não há para quem abrir o requerimento" },
          { status: 422 }
        )
      }

      const { data: novo, error } = await supabase
        .from("processos")
        .insert({
          user_id: user.id,
          cliente_id: importacao.cliente_id,
          esfera: "ADMINISTRATIVO",
          beneficio: proposta.beneficio || "Requerimento INSS",
          protocolo_inss: proposta.protocoloInss ?? null,
          numero_beneficio: proposta.numeroBeneficio ?? null,
          status: proposta.status ?? "EM_ANALISE",
          prazo: proposta.prazo ?? null,
        })
        .select("id, cliente_id, status, beneficio")
        .single()

      if (error || !novo) {
        console.error("Criar requerimento a partir da importação:", error?.message)
        return NextResponse.json(
          { error: "Não foi possível abrir o requerimento" },
          { status: 500 }
        )
      }

      processo = novo as ProcessoDestino
      aplicado.push("requerimento criado")
    } else {
      const { data: existente } = await supabase
        .from("processos")
        .select("id, cliente_id, status, beneficio")
        .eq("id", confirmado.processoId!)
        .in("user_id", await idsDoEscritorio())
        .maybeSingle()

      if (!existente) {
        return NextResponse.json(
          { error: "Processo não encontrado" },
          { status: 404 }
        )
      }

      // O processo tem de ser do mesmo titular da importação, senão um
      // documento previdenciário de uma pessoa entraria no processo de
      // outra.
      if (
        importacao.cliente_id &&
        existente.cliente_id !== importacao.cliente_id
      ) {
        return NextResponse.json(
          { error: "Este processo pertence a outro cliente" },
          { status: 409 }
        )
      }

      processo = existente as ProcessoDestino
    }

    // ── Processo ──
    // Num requerimento recém-criado, status, prazo, benefício e
    // identificadores já entraram no insert. Reaplicar aqui só geraria
    // um update redundante e faria o relatório listar o que não mudou.
    const camposProcesso: Record<string, string> = {}
    if (!confirmado.criarRequerimento) {
      if (confirmado.status && proposta.status) {
        camposProcesso.status = proposta.status
        aplicado.push("status")
      }
      if (confirmado.prazo && proposta.prazo) {
        camposProcesso.prazo = proposta.prazo
        aplicado.push("prazo")
      }
      if (confirmado.beneficio && proposta.beneficio) {
        camposProcesso.beneficio = proposta.beneficio
        aplicado.push("beneficio")
      }
      if (confirmado.identificadores) {
        if (proposta.protocoloInss) {
          camposProcesso.protocolo_inss = proposta.protocoloInss
          aplicado.push("protocolo INSS")
        }
        if (proposta.numeroBeneficio) {
          camposProcesso.numero_beneficio = proposta.numeroBeneficio
          aplicado.push("NB")
        }
      }
    }

    if (Object.keys(camposProcesso).length > 0) {
      const { error } = await supabase
        .from("processos")
        .update(camposProcesso)
        .eq("id", processo.id)
        .in("user_id", await idsDoEscritorio())

      if (error) {
        console.error("Aplicar importação — processo:", error.message)
        return NextResponse.json(
          { error: "Não foi possível atualizar o processo" },
          { status: 500 }
        )
      }
    }

    // ── Andamento ──
    if (confirmado.andamento && proposta.andamento) {
      const { error } = await supabase.from("andamentos").insert({
        processo_id: processo.id,
        user_id: user.id,
        data: hoje,
        descricao: proposta.andamento,
        // O andamento retrata o status resultante. Se o operador não
        // confirmou a mudança de status, o processo segue no atual e o
        // andamento precisa dizer isso, não o status proposto.
        status: camposProcesso.status ?? processo.status,
      })

      if (error) {
        console.error("Aplicar importação — andamento:", error.message)
      } else {
        aplicado.push("andamento")
      }
    }

    // ── Tarefas ──
    let tarefasCriadas = 0
    if (confirmado.tarefas && proposta.tarefas.length > 0) {
      const { data, error } = await supabase
        .from("tarefas")
        .insert(
          proposta.tarefas.map((t) => ({
            user_id: user.id,
            processo_id: processo.id,
            titulo: t.titulo,
            descricao: t.descricao ?? null,
            data: t.data,
            status: "PENDENTE",
            prioridade: t.prioridade,
          }))
        )
        .select("id")

      if (error) {
        console.error("Aplicar importação — tarefas:", error.message)
      } else {
        tarefasCriadas = data?.length ?? 0
        if (tarefasCriadas > 0) aplicado.push(`${tarefasCriadas} tarefa(s)`)
      }
    }

    // Vincula a importação ao processo, para o histórico do painel
    // mostrar onde cada documento foi aplicado.
    if (!importacao.processo_id) {
      await supabase
        .from("importacoes_integracao")
        .update({ processo_id: processo.id })
        .eq("id", id)
        .in("user_id", await idsDoEscritorio())
    }

    await registrarTratamento({
      userId: user.id,
      acao: "IMPORTACAO_INSS",
      entidade: "processo",
      entidadeId: processo.id,
      detalhes: {
        importacaoId: id,
        documento: importacao.documento,
        aplicado: aplicado.join(",") || "nada",
      },
      ip: ipDaRequisicao(request),
    })

    const { data: processoAtualizado } = await supabase
      .from("processos")
      .select("*")
      .eq("id", processo.id)
      .maybeSingle()

    return NextResponse.json(
      {
        message:
          aplicado.length > 0
            ? `Aplicado ao processo: ${aplicado.join(", ")}`
            : "Nada foi aplicado — nenhum campo confirmado",
        aplicado,
        tarefasCriadas,
        processo: toCamelCase(processoAtualizado),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Aplicar importação error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
