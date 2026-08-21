import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { TarefaProtocoloSchema } from "@/lib/validators"
import { avaliarPreparo, temBloqueio } from "@/lib/domain/protocolo"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Passe de bastão: cria a tarefa de protocolar o requerimento.
 *
 * O CRM não protocola — quem protocola é uma pessoa, no portal
 * oficial, com o certificado dela. O que o sistema pode fazer é
 * garantir que essa pessoa receba o pedido com tudo reunido: o que
 * requerer, para quem, com quais documentos já na pasta e quais
 * pendências ficaram.
 *
 * A tarefa é criada **no nome de quem vai executar** (`user_id` do
 * destinatário), porque a agenda lista tarefas por dono. Criar no nome
 * de quem clicou deixaria o pedido invisível justamente para quem
 * precisa vê-lo.
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
    const body = await request.json().catch(() => ({}))
    const validado = TarefaProtocoloSchema.safeParse(body)

    if (!validado.success) {
      const primeiro = validado.error.issues[0]
      return NextResponse.json(
        { error: primeiro?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { data: processo } = await supabase
      .from("processos")
      .select("*, cliente:clientes(nome, cpf, data_nascimento, telefone, email)")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .maybeSingle()

    if (!processo) {
      return NextResponse.json(
        { error: "Processo não encontrado" },
        { status: 404 }
      )
    }

    if (processo.protocolo_inss) {
      return NextResponse.json(
        { error: "Este requerimento já foi protocolado" },
        { status: 409 }
      )
    }

    const destinatario =
      validado.data.responsavelId ?? processo.responsavel_id ?? user.id

    // Destinatário tem de existir; user_id inválido criaria tarefa que
    // não aparece na agenda de ninguém.
    const { data: pessoa } = await supabase
      .from("users")
      .select("id, name")
      .eq("id", destinatario)
      .maybeSingle()

    if (!pessoa) {
      return NextResponse.json(
        { error: "Responsável não encontrado" },
        { status: 404 }
      )
    }

    const { data: irmaos } = await supabase
      .from("processos")
      .select("id, beneficio, esfera, status, protocolo_inss")
      .eq("cliente_id", processo.cliente_id)
      .in("user_id", await idsDoEscritorio())

    const cliente = processo.cliente as {
      nome: string
      cpf: string | null
      data_nascimento: string | null
      telefone: string | null
      email: string | null
    }

    const pendencias = avaliarPreparo({
      cliente: {
        cpf: cliente?.cpf,
        dataNascimento: cliente?.data_nascimento,
        telefone: cliente?.telefone,
        email: cliente?.email,
      },
      processo: {
        id: processo.id,
        beneficio: processo.beneficio,
        esfera: processo.esfera,
        status: processo.status,
      },
      outrosProcessos: (irmaos ?? []).map((p) => ({
        id: p.id as string,
        beneficio: p.beneficio as string,
        esfera: p.esfera as string,
        status: p.status as string,
        protocoloInss: p.protocolo_inss as string | null,
      })),
      baseLegal: validado.data.baseLegal,
    })

    const { count: documentos } = await supabase
      .from("documentos")
      .select("id", { count: "exact", head: true })
      .eq("processo_id", id)

    // A descrição carrega o contexto porque quem recebe a tarefa pode
    // não ser quem montou o caso. Pendências entram inclusive quando
    // bloqueiam: a pessoa precisa saber o que resolver antes de ir ao
    // portal, não descobrir no balcão.
    const descricao = [
      `Cliente: ${cliente?.nome ?? "—"}`,
      `Benefício: ${processo.beneficio}`,
      `Documentos anexados no CRM: ${documentos ?? 0}`,
      validado.data.observacao ? `Observação: ${validado.data.observacao}` : null,
      pendencias.length
        ? `\nAntes de protocolar:\n${pendencias
            .map((p) => `- [${p.gravidade === "bloqueio" ? "impedimento" : "aviso"}] ${p.texto}`)
            .join("\n")}`
        : "\nSem pendências conhecidas.",
    ]
      .filter(Boolean)
      .join("\n")

    const { data: tarefa, error } = await supabase
      .from("tarefas")
      .insert({
        user_id: pessoa.id,
        processo_id: id,
        titulo: `Protocolar ${processo.beneficio} — ${cliente?.nome ?? "cliente"}`,
        descricao,
        data: validado.data.data,
        status: "PENDENTE",
        // Impedimento conhecido rebaixa a urgência: mandar como urgente
        // uma tarefa que não pode ser executada hoje só ensina a
        // ignorar o "urgente".
        prioridade: temBloqueio(pendencias) ? "MEDIA" : "ALTA",
      })
      .select()
      .single()

    if (error || !tarefa) {
      console.error("Criar tarefa de protocolo:", error?.message)
      return NextResponse.json(
        { error: "Não foi possível criar a tarefa" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: `Tarefa criada para ${pessoa.name}`,
        tarefa: toCamelCase(tarefa),
        pendencias,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Tarefa de protocolo error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
