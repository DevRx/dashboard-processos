import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { cifrar, decifrar } from "@/lib/seguranca/cofre"
import { idsDoEscritorio } from "@/lib/escritorio"
import {
  LIMITE_HISTORICO,
  SELECT_HISTORICO,
  comentarioDaLinha,
  type ComentarioBruto,
} from "@/lib/domain/cliente"

/**
 * Campos da ficha administrativa que a equipe edita direto na fila,
 * sem abrir o cadastro do cliente.
 *
 * Vive fora do PUT de /api/clientes/[id] de propósito: aquele endpoint
 * valida o cadastro inteiro e um PUT com o corpo pela metade apagaria
 * telefone, endereço e data de nascimento.
 *
 * O comentário não é um campo do cliente: é um registro no histórico
 * dele, com autor e hora. Mandar um comentário acrescenta; nunca
 * substitui o que outra pessoa escreveu. O banco guarda os
 * LIMITE_HISTORICO mais recentes e poda o resto sozinho.
 */
const FichaSchema = z.object({
  comentario: z
    .string()
    .trim()
    .min(1, "Escreva o comentário antes de registrar")
    .max(5000, "Comentário longo demais")
    .optional(),
  /** String vazia remove a senha guardada. */
  senhaMeuInss: z.string().max(200, "Senha longa demais").optional(),
})

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
    const parsed = FichaSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      )
    }

    const { comentario, senhaMeuInss } = parsed.data

    if (comentario === undefined && senhaMeuInss === undefined) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 })
    }

    // O cliente é do escritório? Conferido antes de qualquer escrita:
    // o insert no histórico não passa pelo filtro de `user_id` da
    // tabela de clientes, então a conferência tem que ser explícita.
    const { data: cliente, error: erroCliente } = await supabase
      .from("clientes")
      .select("id, senha_meu_inss")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .maybeSingle()

    if (erroCliente || !cliente) {
      if (erroCliente) console.error("Update ficha error:", erroCliente.message)
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    let senhaCifrada: string | null = cliente.senha_meu_inss

    if (senhaMeuInss !== undefined) {
      const senha = senhaMeuInss.trim()
      senhaCifrada = senha ? cifrar(senha) : null

      const { error } = await supabase
        .from("clientes")
        .update({ senha_meu_inss: senhaCifrada })
        .eq("id", id)

      if (error) {
        console.error("Update ficha error:", error.message)
        return NextResponse.json(
          { error: "Erro interno do servidor" },
          { status: 500 }
        )
      }
    }

    if (comentario !== undefined) {
      const { error } = await supabase.from("historico_cliente").insert({
        cliente_id: id,
        autor_id: user.id,
        texto: comentario,
      })

      if (error) {
        console.error("Update ficha error:", error.message)
        return NextResponse.json(
          { error: "Erro interno do servidor" },
          { status: 500 }
        )
      }
    }

    // O histórico volta inteiro, já podado, para a tela mostrar o que
    // ficou sem recarregar a fila: quem registrou o quarto comentário
    // precisa ver o primeiro sair.
    const { data: historico, error: erroHistorico } = await supabase
      .from("historico_cliente")
      .select(SELECT_HISTORICO)
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(LIMITE_HISTORICO)

    if (erroHistorico) {
      console.error("Update ficha error:", erroHistorico.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        historico: ((historico ?? []) as ComentarioBruto[]).map(comentarioDaLinha),
        // Devolvida em claro para a tela seguir mostrando o valor sem
        // recarregar a fila inteira.
        senhaMeuInss: senhaCifrada ? decifrar(senhaCifrada) : null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update ficha error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
