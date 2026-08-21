import { readFileSync } from "node:fs"

import type { Acao, Analista, DadosDoCaso, Plano } from "./analista"
import type { ElementoDaTela, Tela } from "./tela"

/**
 * O mesmo trabalho de análise, feito uma vez em vez de a cada execução.
 *
 * A análise ao vivo custa uma credencial e uma chamada por tela. Mas o
 * Meu INSS não muda de layout todo dia: entre uma mudança e outra, a
 * decisão "a fundamentação vai no campo rotulado Observações" é sempre
 * a mesma. O mapa guarda essa decisão — escrita a partir das telas
 * reais, com a Claude olhando os prints — e o robô a executa de graça,
 * quantas vezes precisar.
 *
 * O que se perde é adaptação: tela que não está no mapa não é
 * adivinhada. Ganha-se em troca previsibilidade e custo zero por
 * protocolo, e a falha é sempre a mesma — "não conheço esta tela" —,
 * que é justamente o gatilho para atualizar o mapa.
 */

/** Como achar um elemento na tela lida. Tudo casa sem acento e sem caixa. */
export type Selecao = {
  rotulo?: string
  placeholder?: string
  texto?: string
  tag?: string
  tipo?: string
  /** Quando mais de um casar: qual deles, começando em 1. */
  qual?: number
}

export type AcaoDoMapa =
  | { tipo: "preencher"; onde: Selecao; de: keyof DadosDoCaso; porque: string }
  | { tipo: "selecionar"; onde: Selecao; valor: string; porque: string }
  | { tipo: "clicar"; onde: Selecao; porque: string }
  | { tipo: "anexar"; onde: Selecao; categoria: string; porque: string }

export type TelaDoMapa = {
  id: string
  /** Reconhecimento: todas as marcas precisam bater. */
  reconhecer: { urlContem?: string; tem?: Selecao[] }
  leitura: string
  acoes: AcaoDoMapa[]
  /** Esta é a última tela: depois dela, a pessoa confere e envia. */
  ultima?: boolean
}

export type Mapa = { versao: string; telas: TelaDoMapa[] }

const semAcento = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

function casa(e: ElementoDaTela, sel: Selecao): boolean {
  const contem = (campo: string, alvo?: string) =>
    alvo === undefined || semAcento(campo).includes(semAcento(alvo))

  return (
    contem(e.rotulo, sel.rotulo) &&
    contem(e.placeholder, sel.placeholder) &&
    contem(e.textoVisivel, sel.texto) &&
    (sel.tag === undefined || e.tag === sel.tag) &&
    (sel.tipo === undefined || e.tipo === sel.tipo)
  )
}

function achar(tela: Tela, sel: Selecao): ElementoDaTela | null {
  const achados = tela.elementos.filter((e) => casa(e, sel))
  if (achados.length === 0) return null
  if (sel.qual) return achados[sel.qual - 1] ?? null
  // Sem desempate declarado, ambiguidade é erro — não "pega o primeiro".
  return achados.length === 1 ? achados[0] : null
}

function reconhece(tela: TelaDoMapa, atual: Tela): boolean {
  if (tela.reconhecer.urlContem && !atual.url.includes(tela.reconhecer.urlContem)) return false
  for (const marca of tela.reconhecer.tem ?? []) {
    if (!atual.elementos.some((e) => casa(e, marca))) return false
  }
  return true
}

export function carregarMapa(caminho: string): Mapa {
  return JSON.parse(readFileSync(caminho, "utf8")) as Mapa
}

/** Um analista que consulta o mapa em vez de perguntar ao modelo. */
export function analistaDoMapa(mapa: Mapa): Analista {
  const jaFeitas = new Set<string>()

  return async ({ tela, dados }): Promise<Plano> => {
    const conhecida = mapa.telas.find((t) => reconhece(t, tela))

    if (!conhecida) {
      return {
        situacao: "impedido",
        leitura: `Não conheço esta tela (${tela.url}). O mapa em uso é o ${mapa.versao}.`,
        acoes: [],
      }
    }

    // Tela repetida sem nada novo a fazer significa que o mapa já se
    // esgotou nela — seguir daria laço.
    if (conhecida.ultima || jaFeitas.has(conhecida.id)) {
      return { situacao: "pronto", leitura: conhecida.leitura, acoes: [] }
    }
    jaFeitas.add(conhecida.id)

    const acoes: Acao[] = []

    for (const passo of conhecida.acoes) {
      const alvo = achar(tela, passo.onde)
      if (!alvo) {
        return {
          situacao: "impedido",
          leitura: `Na tela "${conhecida.id}" não achei (ou achei mais de um) o campo de ${passo.porque}. O mapa precisa ser atualizado.`,
          acoes: [],
        }
      }

      if (passo.tipo === "preencher") {
        const valor = dados[passo.de]
        if (typeof valor !== "string" || !valor.trim()) {
          return {
            situacao: "impedido",
            leitura: `O caso não traz "${String(passo.de)}", que esta tela pede.`,
            acoes: [],
          }
        }
        acoes.push({ tipo: "preencher", ref: alvo.ref, valor, porque: passo.porque })
        continue
      }

      if (passo.tipo === "anexar") {
        const doc = dados.documentos.find((d) => d.categoria === passo.categoria)
        if (!doc) {
          return {
            situacao: "impedido",
            leitura: `A tela pede um documento da categoria ${passo.categoria} e a pasta do cliente não tem nenhum.`,
            acoes: [],
          }
        }
        acoes.push({ tipo: "anexar", ref: alvo.ref, documento: doc.id, porque: passo.porque })
        continue
      }

      if (passo.tipo === "selecionar") {
        acoes.push({ tipo: "selecionar", ref: alvo.ref, valor: passo.valor, porque: passo.porque })
        continue
      }

      acoes.push({ tipo: "clicar", ref: alvo.ref, porque: passo.porque })
    }

    return { situacao: "agir", leitura: conhecida.leitura, acoes }
  }
}
