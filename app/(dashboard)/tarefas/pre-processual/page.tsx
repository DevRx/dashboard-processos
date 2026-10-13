import Link from "next/link"
import { ChevronRight, Gavel, Landmark, type LucideIcon } from "lucide-react"

import { Pagina } from "@/components/layout/pagina"
import { CORES_TIME } from "@/components/tarefas/cores-time"
import { cn } from "@/lib/utils"
import {
  COR_DA_ESFERA,
  ESFERAS_PRE,
  ESFERA_PRE_LABEL,
  SLUG_DA_ESFERA,
  type EsferaPre,
} from "@/lib/domain/tarefa"

/**
 * A escolha entre as duas esferas do pré-processual.
 *
 * O menu lateral já leva direto a uma delas; esta página existe para
 * quem chega pelo endereço sem esfera — e responde a mesma pergunta que
 * o menu: administrativo ou judicial?
 */

const ICONE: Record<EsferaPre, LucideIcon> = {
  ADMINISTRATIVO: Landmark,
  JUDICIAL: Gavel,
}

const DESCRICAO: Record<EsferaPre, string> = {
  ADMINISTRATIVO: "Requerimentos no INSS que ainda não foram protocolados.",
  JUDICIAL: "Ações que ainda não foram distribuídas: triagem, peça e protocolo.",
}

export default function PreProcessualPage() {
  return (
    <Pagina titulo="Pré-processual" subtitulo="Escolha a esfera">
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        {ESFERAS_PRE.map((esfera) => {
          const Icone = ICONE[esfera]
          const cor = CORES_TIME[COR_DA_ESFERA[esfera]]
          return (
            <Link
              key={esfera}
              href={`/tarefas/pre-processual/${SLUG_DA_ESFERA[esfera]}`}
              className="group overflow-hidden rounded-2xl bg-card shadow-card transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className={cn("flex items-center gap-3 px-5 py-4", cor.cabecalho)}>
                <Icone size={20} />
                <span className="font-heading flex-1 text-[16px] font-bold tracking-[0.06em] uppercase">
                  {ESFERA_PRE_LABEL[esfera]}
                </span>
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="px-5 py-4 text-[13px] text-muted-foreground">{DESCRICAO[esfera]}</p>
            </Link>
          )
        })}
      </div>
    </Pagina>
  )
}
