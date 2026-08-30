/**
 * O ensaio do login, contra um gov.br de mentira.
 *
 * O login é o único lugar deste projeto com seletor chumbado, e seletor
 * chumbado envelhece — é uma questão de quando. Este ensaio existe para
 * que envelhecer apareça aqui, num comando de dez segundos, e não no meio
 * de um atendimento com o cliente sentado na frente.
 *
 * Nada aqui toca a rede: as telas do Meu INSS e do SSO são servidas por
 * interceptação de rota, dentro do próprio navegador. Dá para rodar sem
 * conta, sem senha e sem internet.
 *
 * O que ele cobre não é "o login funciona" — isso só o gov.br responde.
 * É o contrato em volta: que a entrada completa chega na área logada, que
 * toda surpresa devolve o teclado para a pessoa em vez de falhar, e que a
 * senha não é digitada fora do SSO.
 *
 *   npm run ensaio:login
 */

// Precisa vir antes do import de operador.ts, e por isso o import é
// dinâmico lá embaixo: aquele módulo lê PROTOCOLO_RESPOSTAS uma única
// vez, quando é carregado. Com import estático o env chegaria tarde — o
// ensaio pararia esperando alguém digitar ENTER que ninguém vai digitar.
process.env.PROTOCOLO_URL = "https://ensaio-sem-rede.local"
process.env.PROTOCOLO_RESPOSTAS = "-,-,-,-"

import { chromium, type Browser, type Page } from "playwright"

/** Aqui o navegador do sistema não serve; num container ele mora noutro lugar. */
const CHROMIUM = process.env.PROTOCOLO_CHROMIUM

const CPF = "12345678901"
const SENHA = "senha-que-nao-existe"

const MEU_INSS = "https://meu.inss.gov.br/"
const AREA_LOGADA = "https://meu.inss.gov.br/central-servicos/inicio"
const SSO_CPF = "https://sso.acesso.gov.br/login"
const SSO_SENHA = "https://sso.acesso.gov.br/password"
/** Mesma cara, outro dono. É contra isto que a trava de origem existe. */
const SOSIA = "https://sso-acesso-gov-br.example.com/password"

const pagina = (corpo: string) => `<!doctype html><meta charset=utf8><body>${corpo}</body>`

const porta = (destino: string, rotulo = "Entrar com gov.br") =>
  `<button onclick="location.href='${destino}'">${rotulo}</button>`

const telaCpf = (destino: string, captcha = false) =>
  pagina(
    `<h1>Acesse sua conta</h1>
     <form onsubmit="location.href='${destino}';return false">
       <input id="accountId" autocomplete="username">
       <button id="enter-account-id" type="submit">Continuar</button>
     </form>` + (captcha ? `<div class="g-recaptcha" data-sitekey="0x0">Não sou um robô</div>` : "")
  )

const telaSenha = (destino: string) =>
  pagina(
    `<h1>Digite sua senha</h1>
     <form onsubmit="location.href='${destino}';return false">
       <input id="password" type="password">
       <button id="submit-button" type="submit">Entrar</button>
     </form>`
  )

type Cenario = {
  nome: string
  oQueEnsaia: string
  telas: Record<string, string>
  credenciais: boolean
  /** O que tem de ser verdade no fim. Devolve "" quando passou. */
  conferir: (page: Page) => Promise<string>
}

/** A senha do campo, se a tela ainda for de senha. "" quando não digitou. */
async function senhaNoCampo(page: Page) {
  return page
    .locator("input#password")
    .first()
    .inputValue({ timeout: 2_000 })
    .catch(() => "")
}

const CENARIOS: Cenario[] = [
  {
    nome: "entrada completa",
    oQueEnsaia: "com CPF e senha no .env, entra sozinho e chega na área logada",
    credenciais: true,
    telas: {
      [MEU_INSS]: pagina(`<h1>Meu INSS</h1>${porta(SSO_CPF)}`),
      [SSO_CPF]: telaCpf(SSO_SENHA),
      [SSO_SENHA]: telaSenha(AREA_LOGADA),
      [AREA_LOGADA]: pagina(`<h1>Central de serviços</h1>`),
    },
    conferir: async (page) =>
      page.url() === AREA_LOGADA ? "" : `parou em ${page.url()}, esperava a área logada`,
  },
  {
    nome: "captcha",
    oQueEnsaia: "quando o gov.br pede captcha, devolve o login para a pessoa",
    credenciais: true,
    telas: {
      [MEU_INSS]: pagina(`<h1>Meu INSS</h1>${porta(SSO_CPF)}`),
      [SSO_CPF]: telaCpf(SSO_SENHA, true),
      [SSO_SENHA]: telaSenha(AREA_LOGADA),
    },
    conferir: async (page) =>
      page.url() === SSO_CPF
        ? ""
        : `devia ter parado na tela do captcha; está em ${page.url()}`,
  },
  {
    nome: "seletor envelheceu",
    oQueEnsaia: "quando o site troca de layout, para e chama a pessoa — não quebra",
    credenciais: true,
    telas: {
      // O botão continua lá, com outro nome. É assim que envelhece.
      [MEU_INSS]: pagina(`<h1>Meu INSS</h1><button>Acessar minha conta</button>`),
    },
    conferir: async (page) =>
      page.url() === MEU_INSS ? "" : `não devia ter saído do Meu INSS; está em ${page.url()}`,
  },
  {
    nome: "senha fora do SSO",
    oQueEnsaia: "num domínio parecido com o do gov.br, a senha não é digitada",
    credenciais: true,
    telas: {
      [MEU_INSS]: pagina(`<h1>Meu INSS</h1>${porta(SSO_CPF)}`),
      [SSO_CPF]: telaCpf(SOSIA),
      [SOSIA]: telaSenha(AREA_LOGADA),
    },
    conferir: async (page) => {
      if (page.url() !== SOSIA) return `esperava a página sósia; está em ${page.url()}`
      const digitado = await senhaNoCampo(page)
      return digitado ? "DIGITOU A SENHA num domínio que não é o gov.br" : ""
    },
  },
  {
    nome: "sem credenciais",
    oQueEnsaia: "sem PROTOCOLO_CPF/SENHA, o padrão continua sendo a parada humana",
    credenciais: false,
    telas: {
      [MEU_INSS]: pagina(`<h1>Meu INSS</h1>${porta(SSO_CPF)}`),
      [SSO_CPF]: telaCpf(SSO_SENHA),
    },
    conferir: async (page) =>
      page.url() === MEU_INSS ? "" : `não devia ter mexido em nada; está em ${page.url()}`,
  },
]

async function rodar(browser: Browser, cenario: Cenario, entrar: (p: Page) => Promise<void>) {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()

  await page.route("**/*", (rota) => {
    const html = cenario.telas[rota.request().url()]
    return html
      ? rota.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })
      : rota.fulfill({ status: 404, contentType: "text/html", body: "<h1>404</h1>" })
  })

  if (cenario.credenciais) {
    process.env.PROTOCOLO_CPF = CPF
    process.env.PROTOCOLO_SENHA = SENHA
  } else {
    delete process.env.PROTOCOLO_CPF
    delete process.env.PROTOCOLO_SENHA
  }

  await page.goto(MEU_INSS)
  await entrar(page)
  // A última navegação pode ainda estar em curso quando `entrar` devolve.
  await page.waitForLoadState("load").catch(() => {})

  const problema = await cenario.conferir(page)
  await contexto.close()
  return problema
}

async function principal() {
  // Depois do env acima — ver o comentário no topo.
  const { entrar } = await import("./login")
  const { fecharTerminal } = await import("./operador")

  const browser = await chromium.launch({
    headless: true,
    ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  })

  const falhas: string[] = []

  for (const cenario of CENARIOS) {
    console.log(`\n─── ${cenario.nome} ${"─".repeat(Math.max(0, 50 - cenario.nome.length))}`)
    console.log(`    ${cenario.oQueEnsaia}\n`)

    const problema = await rodar(browser, cenario, entrar).catch(
      (erro) => `explodiu: ${erro instanceof Error ? erro.message.split("\n")[0] : erro}`
    )

    if (problema) falhas.push(`${cenario.nome}: ${problema}`)
    console.log(problema ? `\n  ✗ ${problema}` : `\n  ✓ passou`)
  }

  await browser.close()
  fecharTerminal()

  console.log("\n" + "═".repeat(68))
  if (falhas.length) {
    console.log(`  ${falhas.length} de ${CENARIOS.length} cenários falharam:`)
    for (const f of falhas) console.log(`    ✗ ${f}`)
    console.log("═".repeat(68) + "\n")
    process.exit(1)
  }
  console.log(`  ✓ ${CENARIOS.length} cenários, todos passaram`)
  console.log("═".repeat(68) + "\n")
}

principal()
