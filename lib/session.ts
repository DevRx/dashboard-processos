import "server-only"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { UserRole } from "@/lib/data"

/**
 * Sem `SESSION_SECRET` isto virava uma chave de zero byte — em
 * silêncio. O sistema subia, assinava sessão com nada e só se
 * denunciava depois, do jeito mais confuso possível: gente deslogada
 * sem motivo, e um cookie de sessão que qualquer um forja.
 *
 * Falta de segredo é erro de configuração, e erro de configuração tem
 * que quebrar a build — que é onde alguém está olhando —, não a tela de
 * quem tentou entrar. Mesma regra de lib/supabase/server.ts.
 */
const secretKey = process.env.SESSION_SECRET

if (!secretKey) {
  throw new Error("SESSION_SECRET environment variable is required")
}

const encodedKey = new TextEncoder().encode(secretKey)

export type SessionPayload = {
  userId: string
  name: string
  email: string
  role: UserRole
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = "") {
  if (!session) return null
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    })
    return payload as SessionPayload
  } catch (error) {
    console.log("Failed to verify session:", error)
    return null
  }
}

export async function createSession(payload: SessionPayload) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const session = await encrypt(payload)
  const cookieStore = await cookies()

  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value
  return await decrypt(session)
}
