import Anthropic from "@anthropic-ai/sdk"
import { chromium, type Browser, type Page } from "playwright"
import { mkdirSync } from "node:fs"

import {
  EntradaEncerrada,
  bloco,
  confirmar,
  fecharTerminal,
  pausaHumana,
  relato,
} from "./operador"
import { entrar } from "./login"
import { PassoFalhou } from "./verificacao"
import { AcaoBloqueada, executar } from "./executor"
import { analistaClaude, type Analista, type DadosDoCaso } from "./analista"
import { capturarTela, lerTela, telaEmTexto } from "./tela"

/**
 * Preenchimento assistido do requerimento no Meu INSS.
 *
 * Três camadas, e nenhuma confia sozinha nas outras:
 *
 *   análise  — lê a tela e diz o que preencher onde (scripts/protocolo/analista.ts)
 *   execução — faz e confere se fez (executor.ts + verificacao.ts)
 *   pessoa   — confere o resultado e envia
 *
 * O código não sabe onde ficam os campos, e é de propósito: seletor
 * chumbado envelhece com o site. O que o código garante é o que a
 * análise não pode fazer — enviar o requerimento.
 *
 * Isto NÃO protocola, e a razão não é a mesma do login. Entrar na conta
 * o robô até pode, se você mandar (login.ts): o gov.br não obriga
 * segundo fator. Enviar o requerimento ele não pode em hipótese nenhuma,
 * porque protocolar em nome de cliente é ato de quem responde por ele —
 * ver artifacts/workflows/protocolo_administrativo.md.
 */

const URL_MEU_INSS = process.env.PROTOCOLO_URL ?? "https://meu.inss.gov.br"
/** Rota que só existe depois do login. Confirmar no primeiro teste real. */
const ROTA_LOGADO = process.env.PROTOCOLO_ROTA_LOGADA ?? "**/central-servicos/**"
const HEADLESS = process.env.PROTOCOLO_HEADLESS === "1"
const MINUTOS = 60_000
const ESPERA_LOGIN = Number(process.env.PROTOCOLO_ESPERA_LOGIN ?? 2 * MINUTOS)
/** Cada volta é uma tela lida e analisada. Trava contra laço infinito. */
const MAXIMO_DE_TELAS = Number(process.env.PROTOCOLO_MAX_TELAS ?? 12)
/** Confirmar cada ação antes de executar. Recomendado nos primeiros usos. */
const PASSO_A_PASSO = process.env.PROTOCOLO_PASSO_A_PASSO === "1"

async function conduzir(page: Page, dados: DadosDoCaso, analista: Analista) {
  const historico: string[] = []

  for (let volta = 1; volta <= MAXIMO_DE_TELAS; volta++) {
    const tela = await lerTela(page)
    const captura = await capturarTela(page)
    relato.tentando(`lendo a tela ${volta} (${tela.elementos.length} elementos + imagem)`)

    const plano = await analista({ tela, captura, dados, historico })

    bloco(`tela ${volta} — o que a análise entendeu`, [plano.leitura])

    if (plano.situacao === "pronto") {
      relato.confirmado("a análise considera o requerimento preenchido")
      return
    }

    if (plano.situacao === "impedido") {
      throw new PassoFalhou("análise da tela", plano.leitura)
    }

    if (plano.acoes.length === 0) {
      throw new PassoFalhou(
        "análise da tela",
        "a análise disse para agir mas não indicou nenhuma ação"
      )
    }

    for (const acao of plano.acoes) {
      console.log(`\n  ${acao.porque}`)

      if (PASSO_A_PASSO && !(await confirmar("Faço isso?"))) {
        throw new PassoFalhou("passo a passo", "a pessoa não autorizou esta ação")
      }

      const feito = await executar(page, acao, dados)
      historico.push(`${feito} (${acao.porque})`)
    }
  }

  throw new PassoFalhou(
    "condução",
    `passei por ${MAXIMO_DE_TELAS} telas sem a análise dizer que terminou`
  )
}

/**
 * Quando um passo falha, a tela é a evidência.
 *
 * Fechar o navegador aqui apagaria exatamente o que precisa ser olhado —
 * e no primeiro teste real é essa tela que ensina o que faltou.
 */
async function diagnosticar(page: Page, erro: unknown) {
  const quando = new Date().toISOString().replace(/[:.]/g, "-")
  const foto = `scripts/protocolo/falhas/falha-${quando}.png`
  mkdirSync("scripts/protocolo/falhas", { recursive: true })

  bloco("✗ o robô parou", [
    erro instanceof AcaoBloqueada
      ? "A análise tentou uma ação que só a pessoa pode fazer — e foi barrada."
      : erro instanceof PassoFalhou
        ? `Passo: ${erro.passo}`
        : "Erro inesperado",
    erro instanceof Error ? erro.message : String(erro),
    "",
    `Página no momento da falha: ${page.url()}`,
  ])

  try {
    await page.screenshot({ path: foto, fullPage: true })
    relato.observado(`print salvo em ${foto}`)
  } catch {
    relato.alerta("não consegui salvar o print")
  }

  try {
    const tela = await lerTela(page)
    bloco("o que esta tela realmente oferece", telaEmTexto(tela).split("\n").slice(0, 40))
  } catch {
    /* a página pode ter fechado */
  }
}

export async function assistirProtocolo(dados: DadosDoCaso, analista?: Analista) {
  bloco("preenchimento assistido — Meu INSS", [
    `Cliente:   ${dados.cliente}`,
    `Serviço:   ${dados.beneficio}`,
    dados.nit ? `NIT:       ${dados.nit}` : "NIT:       (não informado)",
    "",
    "A análise decide o preenchimento; o robô digita e confere;",
    "você confere e você protocola. O envio nunca é do robô.",
  ])

  if (!(await confirmar("Abrir o navegador e começar?"))) {
    console.log("\n  Cancelado. Nada foi aberto.\n")
    fecharTerminal()
    return
  }

  const pensar = analista ?? analistaClaude(new Anthropic())
  const browser: Browser = await chromium.launch({ headless: HEADLESS })
  let deuErro = false

  try {
    const page = await browser.newPage()
    await page.goto(URL_MEU_INSS)

    // ── PARADA 1: a entrada na conta ──────────────────────────────
    // Por padrão para aqui e espera a pessoa. Com PROTOCOLO_CPF e
    // PROTOCOLO_SENHA no .env, entra sozinho — e volta a parar sozinho
    // se o gov.br pedir captcha ou mudar de tela (ver login.ts).
    await entrar(page)

    relato.tentando("confirmando que o login valeu")
    try {
      await page.waitForURL(ROTA_LOGADO, { timeout: ESPERA_LOGIN })
    } catch {
      throw new PassoFalhou(
        "login",
        `não reconheci a área logada. Esperava uma URL como "${ROTA_LOGADO}", estou em "${page.url()}"`
      )
    }
    relato.confirmado("login reconhecido")

    await conduzir(page, dados, pensar)

    // ── PARADA 2: a conferência ───────────────────────────────────
    bloco("✓ preenchimento concluído", [
      "Cada campo acima foi lido de volta da tela depois de escrito.",
      "Isso prova que o texto entrou — não que está correto.",
      "",
      "Agora é com você:",
      "  1. leia o formulário inteiro na janela do navegador",
      "  2. confira nome, benefício, datas e anexos",
      "  3. se estiver certo, clique em ENVIAR / PROTOCOLAR você mesma",
      "",
      "O robô não clica em enviar. Nunca.",
    ])

    await pausaHumana("confira e protocole", [
      "Volte aqui depois de protocolar (ou de desistir).",
    ])

    if (await confirmar("O protocolo foi concluído no site?")) {
      bloco("anote o número", [
        "Copie o número do protocolo da tela do INSS e cole no dashboard,",
        "na ficha do cliente. É ele que move o caso de status.",
      ])
    } else {
      relato.observado("nada foi protocolado — o rascunho fica na tela")
    }
  } catch (erro) {
    if (erro instanceof EntradaEncerrada) {
      bloco("entrada encerrada", [
        "O terminal fechou antes de eu receber a resposta.",
        "Nada foi enviado ao INSS. Rode de novo quando puder acompanhar.",
      ])
    } else {
      deuErro = true
      process.exitCode = 1
      const page = browser.contexts()[0]?.pages()[0]
      if (page) await diagnosticar(page, erro)
    }
  } finally {
    if (deuErro) {
      await pausaHumana("navegador continua aberto", [
        "Deixei a tela como estava para você olhar o que aconteceu.",
        "Se este for o primeiro teste real, me mande o print e a lista de",
        "elementos acima — é com isso que eu acerto o preenchimento.",
      ]).catch(() => relato.observado("sem terminal para esperar; fechando"))
    }
    await browser.close()
    fecharTerminal()
    console.log("\n  Navegador fechado.\n")
  }
}
