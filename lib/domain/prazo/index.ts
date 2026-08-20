import { proximoDiaUtil } from "./calendario"

export * from "./calendario"

/**
 * Data-limite de um prazo publicado no diário.
 *
 * A regra do CPC: a disponibilização publica no primeiro dia útil
 * seguinte (art. 224, §2º), o prazo começa a correr no dia útil
 * seguinte à publicação e conta só dias úteis (arts. 219 e 224).
 *
 * O tribunal entra na conta porque o calendário forense é dele: o que
 * é feriado no TJDFT pode ser dia normal no TRF1.
 */
export function calcularPrazoFinal(
  dataDisponibilizacao: string,
  prazoDias: number,
  tribunal?: string | null
): string {
  const disponibilizacao = dataDisponibilizacao.slice(0, 10)

  const publicacao = proximoDiaUtil(disponibilizacao, tribunal)
  let corrente = proximoDiaUtil(publicacao, tribunal)

  // O primeiro dia útil da contagem já é o dia 1.
  for (let i = 1; i < prazoDias; i++) {
    corrente = proximoDiaUtil(corrente, tribunal)
  }

  return corrente
}
