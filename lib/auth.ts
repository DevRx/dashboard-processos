import "server-only"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { db } from "@/lib/db"

export async function getCurrentUser() {
  const session = await getSession()
  if (!session?.userId) return null

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  })

  return user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== "ADMIN") {
    redirect("/")
  }
  return user
}
