import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"

/**
 * Fila judicial: um item por ação em curso.
 *
 * Espelha /api/administrativo do outro lado da esfera. O que muda é o
 * que a tela precisa saber: aqui não há perícia do INSS para etiquetar
 * — há número CNJ, juízo e o último andamento registrado, que é como
 * se sabe se o processo andou.
 */

type ProcessoBruto = {
  id: string
  cliente_id: string
  beneficio: string
  esfera: string | null
  numero: string | null
  status: string
  tribunal: string | null
  vara: string | null
  comarca: string | null
  valor_causa: number | null
  data_entrada: string | null
  prazo: string | null
  cliente: { nome: string; cpf: string | null } | null
  andamentos: { data: string; descricao: string }[] | null
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("processos")
      .select(
        "id, cliente_id, beneficio, esfera, numero, status, tribunal, vara, comarca, valor_causa, data_entrada, prazo, cliente:clientes(nome, cpf), andamentos(data, descricao)"
      )
      .eq("user_id", user.id)
      .eq("esfera", "JUDICIAL")

    if (error) {
      console.error("Fila judicial error:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    // O cliente do PostgREST tipa relação como array mesmo quando ela
    // é para-um; o valor em runtime é o objeto.
    const itens = ((data ?? []) as unknown as ProcessoBruto[]).map((p) => {
      const andamentos = [...(p.andamentos ?? [])].sort((a, b) =>
        b.data.localeCompare(a.data)
      )
      const ultimo = andamentos[0]

      return {
        id: p.id,
        clienteId: p.cliente_id,
        cliente: p.cliente?.nome ?? "Cliente sem nome",
        cpf: p.cliente?.cpf ?? null,
        beneficio: p.beneficio,
        numero: p.numero,
        status: p.status,
        tribunal: p.tribunal,
        vara: p.vara,
        comarca: p.comarca,
        valorCausa: p.valor_causa,
        dataEntrada: p.data_entrada,
        prazo: p.prazo,
        ultimoAndamento: ultimo
          ? { data: ultimo.data, descricao: ultimo.descricao }
          : null,
        totalAndamentos: andamentos.length,
      }
    })

    return NextResponse.json({ itens }, { status: 200 })
  } catch (error) {
    console.error("Fila judicial error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
