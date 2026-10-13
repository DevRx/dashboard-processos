import { CORES_TIME } from "@/components/tarefas/cores-time"
import type { CategoriaAgenda } from "@/lib/domain/tarefa"

/**
 * As cores do calendário de perícias e prazos.
 *
 * Escolhidas pelo escritório, na mesma paridade dos times e das esferas:
 * o vermelho responde pelo judicial, então o **prazo do DJEN é
 * vermelho**; a **perícia é amarela**; e a **exigência fica verde**, para
 * se diferenciar das duas. Perícia e prazo vêm direto da paleta dos
 * times — se a cor de um time mudar, a da agenda acompanha.
 */
export const CORES_CATEGORIA: Record<
  CategoriaAgenda,
  { etiqueta: string; ponto: string; faixa: string }
> = {
  PERICIA: {
    etiqueta: CORES_TIME.AMARELO.cabecalho,
    ponto: CORES_TIME.AMARELO.ponto,
    faixa: CORES_TIME.AMARELO.borda,
  },
  PRAZO: {
    etiqueta: CORES_TIME.VERMELHO.cabecalho,
    ponto: CORES_TIME.VERMELHO.ponto,
    faixa: CORES_TIME.VERMELHO.borda,
  },
  EXIGENCIA: {
    etiqueta: "bg-emerald-600 text-white",
    ponto: "bg-emerald-600",
    faixa: "border-l-emerald-600",
  },
}
