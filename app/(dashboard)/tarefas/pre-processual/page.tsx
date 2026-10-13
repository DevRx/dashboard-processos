import { redirect } from "next/navigation"

/**
 * O pré-processual virou o time amarelo (fluxo de 13/10/2026): os dois
 * lados — administrativo e judicial — com Pendente, Protocolo e
 * Prioridade. O endereço antigo continua levando para lá.
 */
export default function PreProcessualPage() {
  redirect("/times/amarelo")
}
