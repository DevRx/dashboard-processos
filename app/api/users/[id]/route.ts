import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"

/**
 * Liga (ou desliga) um usuário a um escritório. Só ADMIN.
 * É a parte de "quem é de qual escritório" do provisionamento.
 */

const Schema = z.object({
  escritorioId: z.string().uuid().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentUser()
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Só administrador pode mover usuários" },
      { status: 403 }
    )
  }

  const { id } = await params
  const parsed = Schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  }

  const { error } = await supabase
    .from("users")
    .update({ escritorio_id: parsed.data.escritorioId })
    .eq("id", id)

  if (error) {
    console.error("Mover usuário de escritório:", error.message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
