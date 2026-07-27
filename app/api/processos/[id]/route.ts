import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { ProcessoSchema, ProtocoloSchema } from "@/lib/validators"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase, toSnakeCase } from "@/lib/utils"

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

    const { data: processo, error } = await supabase
      .from("processos")
      .select("*, cliente:clientes(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error || !processo) {
      return NextResponse.json(
        { error: "Processo não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ processo: toCamelCase(processo) }, { status: 200 })
  } catch (error) {
    console.error("Get processo error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

/**
 * Registra o protocolo do requerimento apresentado no GERID.
 *
 * Existe separado do PUT porque anotar um número não deve exigir
 * reenviar o processo inteiro: a interface poderia mandar de volta um
 * campo desatualizado e sobrescrever o que estava certo no banco.
 *
 * Ao protocolar, o caso passa a `AGUARDANDO_INSS` — protocolado é
 * exatamente isso, esperando o INSS. Deixar em "Em análise" faria o
 * kanban mentir sobre de quem é a bola.
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
    const validado = ProtocoloSchema.safeParse(body)

    if (!validado.success) {
      const primeiro = validado.error.issues[0]
      return NextResponse.json(
        { error: primeiro?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    // A DER só é gravada quando informada. Mandar `null` no lugar
    // apagaria a data de entrada já registrada de quem protocolou sem
    // preencher esse campo.
    const campos: Record<string, string> = {
      protocolo_inss: validado.data.protocoloInss,
      status: "AGUARDANDO_INSS",
    }
    if (validado.data.dataEntrada) {
      campos.data_entrada = validado.data.dataEntrada
    }

    const { data: processo, error } = await supabase
      .from("processos")
      .update(campos)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle()

    if (error) {
      console.error("Registrar protocolo error:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    if (!processo) {
      return NextResponse.json(
        { error: "Processo não encontrado" },
        { status: 404 }
      )
    }

    // Andamento para o histórico registrar de onde veio o protocolo.
    await supabase.from("andamentos").insert({
      processo_id: id,
      user_id: user.id,
      data: new Date().toISOString().slice(0, 10),
      descricao: `Requerimento protocolado no INSS — protocolo ${validado.data.protocoloInss}`,
      status: "AGUARDANDO_INSS",
    })

    return NextResponse.json(
      { message: "Protocolo registrado", processo: toCamelCase(processo) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Registrar protocolo error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    const validatedFields = ProcessoSchema.safeParse(body)

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { data: processo, error } = await supabase
      .from("processos")
      .update(toSnakeCase(validatedFields.data))
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !processo) {
      console.error("Update processo error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Processo atualizado com sucesso", processo: toCamelCase(processo) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update processo error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const { error } = await supabase
      .from("processos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      console.error("Delete processo error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Processo excluído com sucesso" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete processo error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
