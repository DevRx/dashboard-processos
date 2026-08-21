import { existsSync } from "node:fs"

import { analistaClaude, temCredencial, type Analista, type Plano } from "./analista"
import { analistaDoMapa, carregarMapa } from "./mapa"
import { relato } from "./operador"

/**
 * Qual análise conduz o preenchimento.
 *
 * O mapa vem primeiro por três razões: não custa credencial, responde
 * na hora e faz sempre a mesma coisa — e o que uma secretária precisa
 * num requerimento é justamente que hoje seja igual a ontem.
 *
 * O modelo entra onde o mapa não alcança: tela nova, etapa que o INSS
 * acrescentou, formulário que mudou de lugar. Se não houver credencial,
 * o robô para ali e mostra a tela — que é o material com que o mapa é
 * corrigido para a próxima vez.
 */

const CAMINHO_MAPA = process.env.PROTOCOLO_MAPA ?? "scripts/protocolo/mapa-inss.json"

export function escolherAnalista(): Analista {
  const temMapa = existsSync(CAMINHO_MAPA)
  const temModelo = temCredencial()

  if (!temMapa && !temModelo) {
    throw new Error(
      "não há mapa de campos nem credencial da Anthropic — sem os dois não há como decidir o preenchimento.\n" +
        `    Escreva ${CAMINHO_MAPA} a partir das telas reais, ou preencha ANTHROPIC_API_KEY no .env.`
    )
  }

  if (!temMapa) {
    relato.observado("sem mapa de campos: a análise vai ao modelo em todas as telas")
    return analistaClaude()
  }

  const mapa = carregarMapa(CAMINHO_MAPA)
  const doMapa = analistaDoMapa(mapa)

  if (!temModelo) {
    relato.observado(`mapa ${mapa.versao}, sem credencial: tela desconhecida faz o robô parar`)
    return doMapa
  }

  relato.observado(`mapa ${mapa.versao}, com modelo de reserva para tela desconhecida`)
  const doModelo = analistaClaude()

  return async (entrada): Promise<Plano> => {
    const pelo = await doMapa(entrada)

    // "Impedido" pelo mapa quer dizer "não sei esta tela" — é aí que
    // vale gastar uma chamada. Impedimento por falta de dado no caso
    // não muda com quem analisa, mas o modelo explica melhor o que falta.
    if (pelo.situacao !== "impedido") return pelo

    relato.observado("o mapa não cobre esta tela; perguntando ao modelo")
    return doModelo(entrada)
  }
}
