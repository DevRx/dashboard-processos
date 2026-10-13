import { Pagina } from "@/components/layout/pagina"
import { PainelTimes } from "@/components/tarefas/painel-times"

/** Os quatro times e as etapas de cada um, numa tela só. */
export default function TimesPage() {
  return (
    <Pagina titulo="Times" subtitulo="Cada cor é um time; cada time, as suas etapas">
      <PainelTimes />
    </Pagina>
  )
}
