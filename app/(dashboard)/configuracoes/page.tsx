import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default function ConfiguracoesPage() {
  return (
    <div className="flex min-h-screen bg-zinc-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header title="Configurações" subtitle="Preferências do sistema." />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="mt-2 text-sm text-muted-foreground">Preferências do sistema e perfil.</p>
        </main>
      </div>
    </div>
  )
}
