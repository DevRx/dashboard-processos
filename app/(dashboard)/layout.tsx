import { Sidebar } from "@/components/layout/sidebar"
import { UsuarioProvider } from "@/components/layout/usuario-context"
import { getSession } from "@/lib/session"

/**
 * Casca de toda tela pós-login: a navegação à esquerda e a coluna de
 * conteúdo à direita.
 *
 * Morava repetida em cada página, e cada cópia envelhecia de um jeito —
 * umas com `bg-zinc-100`, outras com `bg-background`, uma sem tema
 * escuro. Aqui ela existe uma vez, e a página só diz o que é dela: o
 * título, as ações e o conteúdo.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const usuario = session
    ? {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
      }
    : null

  return (
    <UsuarioProvider usuario={usuario}>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </UsuarioProvider>
  )
}
