import type { UserRole } from "@/lib/data"

/**
 * Nome de cada papel, em português e sem sigla. Vive fora de qualquer
 * componente cliente para poder ser lido também por componentes de
 * servidor — um valor exportado de um módulo "use client" chega ao
 * servidor como referência, não como objeto.
 */
export const ROTULO_POR_PAPEL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  ADVOGADO: "Advogado",
  ASSISTENTE: "Assistente",
  USER: "Usuário",
}
