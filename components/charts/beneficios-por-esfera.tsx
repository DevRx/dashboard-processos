import { BeneficiosPizza, type FatiaBeneficio } from "./beneficios-pizza"

/**
 * As duas esferas lado a lado.
 *
 * Administrativo e judicial não são etapas da mesma fila — são dois
 * trabalhos com ritmo, prazo e responsável diferentes. Somar os dois num
 * gráfico só esconderia qual deles está carregado, então cada um tem a
 * sua pizza e a comparação fica com quem lê.
 */
export function BeneficiosPorEsfera({
  administrativo,
  judicial,
}: {
  administrativo: FatiaBeneficio[]
  judicial: FatiaBeneficio[]
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BeneficiosPizza
        titulo="Administrativo"
        descricao="Requerimentos no INSS"
        fatias={administrativo}
        vazio="Nenhum processo administrativo cadastrado."
      />
      <BeneficiosPizza
        titulo="Judicial"
        descricao="Ações na justiça"
        fatias={judicial}
        vazio="Nenhum processo judicial cadastrado."
      />
    </div>
  )
}
