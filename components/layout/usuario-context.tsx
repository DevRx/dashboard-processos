"use client"

import { createContext, useContext } from "react"
import type { UserRole } from "@/lib/data"

export type UsuarioLogado = {
  id: string
  name: string
  email: string
  role: UserRole
}

export { ROTULO_POR_PAPEL } from "@/lib/papeis"

const UsuarioContext = createContext<UsuarioLogado | null>(null)

/**
 * Quem está logado, lido uma vez no layout e entregue a toda a árvore.
 *
 * Antes o cabeçalho buscava `/api/auth/me` a cada troca de página, e o
 * avatar aparecia vazio por um instante. O layout já tem a sessão em
 * mãos; é só passá-la adiante.
 */
export function UsuarioProvider({
  usuario,
  children,
}: {
  usuario: UsuarioLogado | null
  children: React.ReactNode
}) {
  return (
    <UsuarioContext.Provider value={usuario}>{children}</UsuarioContext.Provider>
  )
}

export function useUsuario() {
  return useContext(UsuarioContext)
}
