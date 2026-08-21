import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { SITUACOES_PERICIA } from "@/lib/domain/processo"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Etiqueta de perícia do auxílio por incapacidade, trocada direto na
 * fila. `null` tira a etiqueta.
 */
const PericiaSchema = z.object({
  situacaoPericia: z.enum(SITUACOES_PERICIA).nullable(),
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
    const parsed = PericiaSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Situação de perícia inválida" },
        { status: 400 }
      )
    }

    const { data: processo, error } = await supabase
      .from("processos")
      .update({ situacao_pericia: parsed.data.situacaoPericia })
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .select("id, situacao_pericia")
      .maybeSingle()

    if (error || !processo) {
      console.error("Update perícia error:", error?.message)
      return NextResponse.json(
        { error: "Processo não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { situacaoPericia: processo.situacao_pericia },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update perícia error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
