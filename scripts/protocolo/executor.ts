import { resolve } from "node:path"
import type { Page } from "playwright"

import type { Acao, DadosDoCaso } from "./analista"
import { PassoFalhou, anexarEConferir, alvoUnico, preencherEConferir } from "./verificacao"
import { porRef } from "./tela"
import { relato } from "./operador"

/**
 * Quem executa o que a análise propôs — e o que ela não pode propor.
 *
 * O prompt manda a análise nunca enviar o requerimento. Isso é uma
 * instrução, e instrução se descumpre: basta o site chamar "Avançar" o
 * botão que protocola. Por isso a proibição também mora aqui, onde é
 * regra de código e não pedido em português.
 */

/** Palavras que, num botão, significam "isto sai do escritório". */
const ENVIO =
  /\b(enviar|protocolar|protocolo|finalizar|concluir|assinar|transmitir|submeter|confirmar\s+envio)\b/i

export class AcaoBloqueada extends Error {
  constructor(readonly rotulo: string) {
    super(`ação bloqueada: "${rotulo}" parece ser o envio do requerimento`)
    this.name = "AcaoBloqueada"
  }
}

async function clicarEObservar(nome: string, page: Page, ref: string) {
  const alvo = await alvoUnico(nome, porRef(page, ref))

  const rotulo =
    (await alvo.getAttribute("aria-label")) ??
    (await alvo.textContent())?.trim() ??
    (await alvo.getAttribute("value")) ??
    ""

  if (ENVIO.test(rotulo)) throw new AcaoBloqueada(rotulo)

  const urlAntes = page.url()
  const quantosAntes = await page.locator("[data-ref-protocolo]").count()

  await alvo.click()

  // Um clique que não muda nada é o mesmo que não ter clicado — e foi
  // assim que a primeira versão deste script achou que tinha navegado.
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100)
    const mudouUrl = page.url() !== urlAntes
    const sumiu = !(await alvo.isVisible().catch(() => false))
    const mudouTela = (await page.locator("[data-ref-protocolo]").count()) !== quantosAntes
    if (mudouUrl || sumiu || mudouTela) {
      relato.confirmado(`${nome} — a tela reagiu${mudouUrl ? ` (agora em ${page.url()})` : ""}`)
      return
    }
  }

  throw new PassoFalhou(nome, `cliquei em "${rotulo}" e nada mudou na tela`)
}

/**
 * O elemento aceita esta ação?
 *
 * A análise às vezes erra de categoria — mandar digitar num link, marcar
 * opção num campo de texto. Sem esta conferência o erro chega como uma
 * mensagem de biblioteca ("Element is not an <input>…") que não diz a
 * quem lê o terminal o que de fato aconteceu.
 */
async function conferirCompatibilidade(nome: string, page: Page, acao: Acao) {
  const tag = await porRef(page, acao.ref)
    .evaluate((e) => `${e.tagName.toLowerCase()}:${(e as HTMLInputElement).type ?? ""}`)
    .catch(() => "")

  if (!tag) throw new PassoFalhou(nome, `não achei o elemento "${acao.ref}" nesta tela`)

  const [etiqueta, tipo] = tag.split(":")
  const digitavel = etiqueta === "input" || etiqueta === "textarea"
  const arquivo = etiqueta === "input" && tipo === "file"

  if ((acao.tipo === "preencher" && (!digitavel || arquivo)) ||
      (acao.tipo === "selecionar" && etiqueta !== "select") ||
      (acao.tipo === "anexar" && !arquivo)) {
    throw new PassoFalhou(
      nome,
      `a análise mandou "${acao.tipo}" num <${etiqueta}${tipo ? ` ${tipo}` : ""}>, que não aceita isso`
    )
  }
}

export async function executar(
  page: Page,
  acao: Acao,
  dados: DadosDoCaso
): Promise<string> {
  const nome = `${acao.tipo} ${acao.ref}`
  await conferirCompatibilidade(nome, page, acao)

  try {
    return await despachar(page, acao, dados)
  } catch (erro) {
    // Erro de biblioteca vira erro de passo: quem lê o terminal precisa
    // saber qual ação falhou, não qual função interna reclamou.
    if (erro instanceof PassoFalhou || erro instanceof AcaoBloqueada) throw erro
    const detalhe = erro instanceof Error ? erro.message.split("\n")[0] : String(erro)
    throw new PassoFalhou(nome, detalhe)
  }
}

async function despachar(
  page: Page,
  acao: Acao,
  dados: DadosDoCaso
): Promise<string> {
  switch (acao.tipo) {
    case "preencher": {
      const nome = `preencher ${acao.ref}`
      await preencherEConferir(nome, porRef(page, acao.ref), acao.valor)
      return `preencheu "${acao.valor.slice(0, 40)}${acao.valor.length > 40 ? "…" : ""}"`
    }

    case "selecionar": {
      const nome = `selecionar ${acao.ref}`
      relato.tentando(nome)
      const campo = await alvoUnico(nome, porRef(page, acao.ref))
      await campo.selectOption({ label: acao.valor })
      const lido = await campo.inputValue()
      if (!lido) throw new PassoFalhou(nome, `a opção "${acao.valor}" não ficou marcada`)
      relato.confirmado(`${nome} — "${acao.valor}" marcado`)
      return `escolheu "${acao.valor}"`
    }

    case "clicar": {
      await clicarEObservar(`clicar ${acao.ref}`, page, acao.ref)
      return "clicou"
    }

    case "anexar": {
      const doc = dados.documentos.find((d) => d.id === acao.documento)
      if (!doc) {
        throw new PassoFalhou(
          `anexar ${acao.documento}`,
          `a análise pediu um documento que não está na pasta do cliente`
        )
      }
      await anexarEConferir(
        `anexar ${doc.nome}`,
        porRef(page, acao.ref),
        resolve(process.cwd(), doc.caminho)
      )
      return `anexou "${doc.nome}" (${doc.categoria})`
    }
  }
}
