import type { Locator, Page } from "playwright"
import { relato } from "./operador"

/**
 * Nada é dado por feito sem prova.
 *
 * O erro central da primeira versão não foi um seletor errado — foi
 * seguir adiante sem conferir. O clique caiu num `<h2>` em vez do link,
 * a página não mudou, e o script continuou anunciando sucesso até travar
 * trinta segundos depois num campo que nunca existiu naquela tela.
 *
 * Aqui todo passo que muda estado é seguido de uma leitura que confirma
 * a mudança. Quando a confirmação falha, o robô para no lugar do erro —
 * não três passos depois, onde a causa já não é visível.
 */

export class PassoFalhou extends Error {
  constructor(
    readonly passo: string,
    readonly detalhe: string
  ) {
    super(`${passo}: ${detalhe}`)
    this.name = "PassoFalhou"
  }
}

/** Um alvo só. Mais de um match é erro, não "pega o primeiro". */
export async function alvoUnico(
  nome: string,
  loc: Locator,
  timeout = 15_000
): Promise<Locator> {
  try {
    await loc.first().waitFor({ state: "visible", timeout })
  } catch {
    throw new PassoFalhou(nome, `não apareceu em ${timeout / 1000}s`)
  }

  const quantos = await loc.count()

  if (quantos > 1) {
    const amostra: string[] = []
    for (let i = 0; i < Math.min(quantos, 5); i++) {
      amostra.push(
        await loc.nth(i).evaluate((e) => `<${e.tagName.toLowerCase()}> ${(e.textContent ?? "").trim().slice(0, 50)}`)
      )
    }
    throw new PassoFalhou(
      nome,
      `${quantos} elementos casaram — ambíguo demais para clicar às cegas:\n      ${amostra.join("\n      ")}`
    )
  }

  return loc
}

/**
 * A parte da URL que significa "outra página".
 *
 * O fragmento não conta: um link morto (`href="#"`) muda `location.href`
 * sem sair do lugar, e comparar a URL inteira aceitaria isso como
 * navegação — dando o passo por bem-sucedido e empurrando a falha para
 * três passos adiante, longe da causa.
 */
function enderecoSemFragmento(url: string) {
  const u = new URL(url)
  return u.origin + u.pathname + u.search
}

/**
 * Espera sair de um endereço conhecido.
 *
 * Recebe o `antes` de fora de propósito: quem chama tira a foto do
 * endereço no instante certo. Deixar esta função ler a URL sozinha foi
 * o que escondeu um erro — o passo seguinte a uma busca começava com a
 * navegação da busca ainda em curso, comparava contra a página velha e
 * dava qualquer coisa por navegada.
 */
export async function esperarNavegacao(
  nome: string,
  page: Page,
  antes: string,
  timeout = 20_000
) {
  const partida = enderecoSemFragmento(antes)
  try {
    await page.waitForURL((u) => enderecoSemFragmento(u.href) !== partida, { timeout })
  } catch {
    throw new PassoFalhou(
      nome,
      `continuei na mesma página (${partida}) — o alvo provavelmente não leva a lugar nenhum`
    )
  }
  relato.confirmado(`${nome} — agora em ${page.url()}`)
}

/** Clica e exige que a navegação tenha de fato acontecido. */
export async function clicarENavegar(nome: string, page: Page, loc: Locator) {
  relato.tentando(nome)
  const alvo = await alvoUnico(nome, loc)
  const antes = page.url()
  await alvo.click()
  await esperarNavegacao(nome, page, antes)
}

/** Preenche e relê do campo. Se não bateu, não preencheu. */
export async function preencherEConferir(
  nome: string,
  loc: Locator,
  valor: string
) {
  relato.tentando(nome)
  const campo = await alvoUnico(nome, loc)
  await campo.fill(valor)

  const lido = await campo.inputValue()
  if (lido.trim() !== valor.trim()) {
    throw new PassoFalhou(
      nome,
      `o campo aceitou algo diferente do enviado (esperado ${valor.length} caracteres, li ${lido.length})`
    )
  }

  relato.confirmado(`${nome} — ${lido.length} caracteres conferidos no campo`)
}

/** Anexa e exige que a tela reconheça o arquivo. */
export async function anexarEConferir(
  nome: string,
  loc: Locator,
  caminho: string
) {
  relato.tentando(nome)
  const campo = await alvoUnico(nome, loc)
  await campo.setInputFiles(caminho)

  const anexado = await campo.evaluate(
    (e) => (e as HTMLInputElement).files?.[0]?.name ?? ""
  )
  if (!anexado) throw new PassoFalhou(nome, "o campo continuou sem arquivo")

  relato.confirmado(`${nome} — "${anexado}" reconhecido pela tela`)
}

/**
 * Pop-up que pode ou não aparecer.
 *
 * `isVisible()` responde na hora e diz "não" para o que ainda está
 * carregando — o que transforma latência de rede em passo pulado. Aqui a
 * ausência é esperada por um tempo antes de virar conclusão.
 */
export async function seAparecer(
  nome: string,
  loc: Locator,
  aoAparecer: () => Promise<void>,
  timeout = 6_000
) {
  try {
    await loc.first().waitFor({ state: "visible", timeout })
  } catch {
    relato.observado(`${nome}: não apareceu (seguindo)`)
    return false
  }

  relato.tentando(`${nome} — apareceu, tratando`)
  await aoAparecer()
  relato.confirmado(`${nome} tratado`)
  return true
}
