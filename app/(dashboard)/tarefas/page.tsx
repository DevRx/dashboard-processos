"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { QuadroTarefas } from "@/components/tarefas/quadro-tarefas"

/**
 * Quadro de tarefas do escritório.
 *
 * Saiu de dentro do Administrativo: tarefa não é assunto de
 * requerimento no INSS — ela atravessa o escritório inteiro, inclusive
 * o que ainda nem virou processo. Aqui ela tem a tela toda.
 */
export default function TarefasPage() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header
          title="Tarefas"
          subtitle="Quadro do escritório por time e responsável"
        />
        <main className="flex-1 space-y-4 p-6">
          <p className="text-[12.5px] text-muted-foreground">
            A cor é o time; o nome no alto do cartão é quem responde por ela.
            Arraste o cartão de uma coluna para outra para mudar de time, e
            clique nas iniciais para passar a tarefa a outra pessoa.
          </p>

          <QuadroTarefas />
        </main>
      </div>
    </div>
  )
}
