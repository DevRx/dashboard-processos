import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"

export default function AgendaPage() {
  return (
    <div className="flex min-h-screen bg-zinc-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="mt-2 text-sm text-muted-foreground">Gerencie compromissos e prazos.</p>
        </main>
      </div>
    </div>
  )
}
