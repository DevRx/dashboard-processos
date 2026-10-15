import "server-only"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { membroDaEquipe } from "@/lib/equipe"
import { UserRole } from "@/lib/data"

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession()
  if (!session?.userId) return null

  // O papel que vale é o do banco, não o da sessão — lido pelo cache da
  // equipe (lib/equipe.ts): uma ida ao banco por minuto, não por pedido.
  // Um papel trocado passa a valer em até um minuto.
  const user = await membroDaEquipe(session.userId).catch(() => null)
  if (!user) return null

  return { id: user.id, name: user.name, email: user.email, role: user.role as UserRole }
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  return user
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth()
  if (user.role !== "ADMIN") {
    redirect("/")
  }
  return user
}

export async function requireRole(
  allowedRoles: UserRole[]
): Promise<CurrentUser> {
  const user = await requireAuth()
  if (!allowedRoles.includes(user.role)) {
    redirect("/")
  }
  return user
}
