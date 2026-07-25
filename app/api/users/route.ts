import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth"
import { toCamelCase } from "@/lib/utils"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { data: users, error } = await supabase
      .from("users")
      .select("id, name, email, role")
      .order("name", { ascending: true })

    if (error) {
      console.error("Get users error:", error)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json({ users: toCamelCase(users) }, { status: 200 })
  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
