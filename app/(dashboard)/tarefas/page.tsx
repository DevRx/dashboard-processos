"use client"

import { Pagina } from "@/components/layout/pagina"
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
    <Pagina titulo="Tarefas" subtitulo="Quadro do escritório por time e responsável" className="space-y-4">
      <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
        A cor é o time; o nome no alto do cartão é quem responde por ela.
        Arraste o cartão de uma coluna para outra para mudar de time, e
        clique nas iniciais para passar a tarefa a outra pessoa.
      </p>

      <QuadroTarefas />
    </Pagina>
  )
}
