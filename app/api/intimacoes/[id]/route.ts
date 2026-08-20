import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"

/**
 * Estado da intimação dentro do escritório: tratada ou não, e a qual
 * processo ela pertence quando o casamento automático não achou.
 *
 * O conteúdo publicado no diário nunca é editável — é registro
 * oficial, e reescrevê-lo aqui seria falsear a fonte.
 */
const IntimacaoPatchSchema = z
  .object({
    tratada: z.boolean().optional(),
    processoId: z.string().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nada para atualizar" })

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
    const parsed = IntimacaoPatchSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      )
    }

    const campos: Record<string, string | null> = {}

    if (parsed.data.tratada !== undefined) {
      campos.tratada_em = parsed.data.tratada ? new Date().toISOString() : null
    }

    if (parsed.data.processoId !== undefined) {
      if (parsed.data.processoId) {
        // Vincular a um processo de outro escritório vazaria a
        // intimação para fora da conta.
        const { data: processo } = await supabase
          .from("processos")
          .select("id")
          .eq("id", parsed.data.processoId)
          .eq("user_id", user.id)
          .maybeSingle()

        if (!processo) {
          return NextResponse.json(
            { error: "Processo não encontrado" },
            { status: 404 }
          )
        }
      }

      campos.processo_id = parsed.data.processoId
    }

    const { data: intimacao, error } = await supabase
      .from("comunicacoes_djen")
      .update(campos)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, tratada_em, processo_id")
      .maybeSingle()

    if (error || !intimacao) {
      console.error("Atualizar intimação:", error?.message)
      return NextResponse.json(
        { error: "Intimação não encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json({ intimacao }, { status: 200 })
  } catch (error) {
    console.error("Atualizar intimação error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
