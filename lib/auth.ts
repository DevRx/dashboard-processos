import "server-only"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
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

  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("id", session.userId)
    .maybeSingle()

  if (error || !user) {
    return null
  }

  return toCamelCase(user) as CurrentUser
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
