"use client"

import { useState } from "react"

import { Pagina } from "@/components/layout/pagina"
import { useUsuario } from "@/components/layout/usuario-context"
import { ImportarTickTick } from "@/components/tarefas/importar-ticktick"
import { QuadroTarefas } from "@/components/tarefas/quadro-tarefas"

/**
 * Quadro de tarefas do escritório.
 *
 * Saiu de dentro do Administrativo: tarefa não é assunto de
 * requerimento no INSS — ela atravessa o escritório inteiro, inclusive
 * o que ainda nem virou processo. Aqui ela tem a tela toda.
 */
export default function TarefasPage() {
  const usuario = useUsuario()
  // Trocar a chave remonta o quadro, que busca a lista de novo — o
  // jeito mais curto de mostrar o que a importação acabou de trazer.
  const [versao, setVersao] = useState(0)

  return (
    <Pagina titulo="Tarefas" subtitulo="Quadro do escritório por time e responsável" className="space-y-4">
      <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
        A cor é o time; o nome no alto do cartão é quem responde por ela.
        Arraste o cartão de uma coluna para outra para mudar de time, e
        clique nas iniciais para passar a tarefa a outra pessoa. As pastas
        dentro de cada time são as listas que vieram do TickTick.
      </p>

      {usuario?.role === "ADMIN" ? (
        <ImportarTickTick onImportou={() => setVersao((v) => v + 1)} />
      ) : null}

      <QuadroTarefas key={versao} />
    </Pagina>
  )
}
