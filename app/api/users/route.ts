import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { equipe } from "@/lib/equipe"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Do cache da equipe (lib/equipe.ts): a tela pede isto a cada abertura.
    const users = await equipe()
    return NextResponse.json({ users }, { status: 200 })
  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
