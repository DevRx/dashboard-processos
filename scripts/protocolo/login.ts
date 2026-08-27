import type { Page } from "playwright"

import { pausaHumana, relato } from "./operador"

/**
 * A entrada na conta — sua, quando você mandar; sua, quando não mandar.
 *
 * Este arquivo existe porque a regra antiga ("o robô nunca faz login")
 * misturava duas coisas diferentes. Uma é técnica e caiu: a verificação
 * em duas etapas do gov.br é opcional, então uma conta sem ela entra com
 * CPF e senha e um `fill` dá conta. A outra continua de pé e não é
 * técnica: a senha tem que ser de quem opera, não do cliente.
 *
 * Então o login automático é opt-in e o padrão continua sendo a parada
 * humana. Duas travas moram aqui, e nenhuma é conselho:
 *
 *   1. a senha só é digitada em página do próprio SSO do gov.br;
 *   2. qualquer surpresa — captcha, campo que não apareceu, seletor que
 *      envelheceu — devolve o teclado para a pessoa em vez de falhar.
 *
 * A segunda é o que torna aceitável o que vem a seguir: seletor chumbado,
 * justamente o que `tela.ts` evita no resto do fluxo. Aqui não há escolha
 * melhor. Mandar esta tela para a análise significaria mandar o campo de
 * senha junto, e senha não entra em prompt. O preço do seletor fixo é
 * envelhecer com o site; como envelhecer aqui só custa uma parada humana
 * — a mesma que existiria sem este arquivo —, o preço cabe.
 */

/** Só existe conta gov.br no gov.br. Vale para a senha, não para o CPF. */
const ORIGEM_SSO = /^https:\/\/sso\.acesso\.gov\.br\//

/**
 * Cada passo tenta vários seletores porque o gov.br já trocou o `id` do
 * botão de avançar pelo menos uma vez. A lista é ordenada do mais
 * específico para o mais genérico; o genérico sozinho seria arriscado,
 * como último recurso é melhor que desistir.
 */
const CAMPO_CPF = 'input#accountId, input[name="accountId"], input[autocomplete="username"]'
const BOTAO_CPF = "button#enter-account-id, button#enter-button, form button[type=submit]"
const CAMPO_SENHA = 'input#password, input[name="password"], input[type="password"]'
const BOTAO_SENHA = "button#submit-button, form button[type=submit]"

/** Captcha é presença humana pedida por escrito. Não se contorna. */
const CAPTCHA =
  'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, [data-sitekey], [id*="captcha" i]'

const INSTRUCOES_MANUAIS = [
  "Na janela que abriu:",
  "  1. clique em 'Entrar com gov.br'",
  "  2. entre com a sua conta — senha, segundo fator se você usa,",
  "     ou o certificado digital",
  "  3. espere carregar a área logada",
  "",
  "Sem pressa — o robô espera o tempo que for preciso.",
]

/** CPF em log é dado de pessoa. Confirma qual conta sem publicar o número. */
function mascarar(cpf: string) {
  const so = cpf.replace(/\D/g, "")
  return so.length >= 4 ? `***.***.**${so.slice(-2)}` : "***"
}

class LoginManual extends Error {
  constructor(readonly motivo: string) {
    super(motivo)
    this.name = "LoginManual"
  }
}

async function exigirSemCaptcha(page: Page) {
  if (await page.locator(CAPTCHA).first().isVisible({ timeout: 1_000 }).catch(() => false)) {
    throw new LoginManual("o gov.br pediu captcha")
  }
}

async function exigirNoSSO(page: Page) {
  if (!ORIGEM_SSO.test(page.url())) {
    throw new LoginManual(`a página de senha não é o SSO do gov.br (estou em ${page.url()})`)
  }
}

/**
 * Espera o campo e devolve. A ausência não é falha do script: é o site
 * fazendo outra coisa — outro método de entrada, aviso, manutenção —, e
 * quem resolve isso é quem está olhando a tela.
 */
async function esperarCampo(page: Page, seletor: string, oQue: string, timeout = 20_000) {
  const campo = page.locator(seletor).first()
  try {
    await campo.waitFor({ state: "visible", timeout })
  } catch {
    throw new LoginManual(`não encontrei ${oQue} nesta tela`)
  }
  return campo
}

async function avancar(page: Page, seletor: string, oQue: string) {
  const botao = page.locator(seletor).first()
  if (!(await botao.isVisible().catch(() => false))) {
    throw new LoginManual(`não encontrei ${oQue}`)
  }
  await botao.click()
}

async function automatico(page: Page, cpf: string, senha: string) {
  relato.tentando(`entrando no gov.br como ${mascarar(cpf)}`)

  await avancar(
    page,
    ':is(button, a):has-text("Entrar com gov.br")',
    'o botão "Entrar com gov.br"'
  )

  try {
    await page.waitForURL(ORIGEM_SSO, { timeout: 20_000 })
  } catch {
    throw new LoginManual("o clique em 'Entrar com gov.br' não levou ao SSO")
  }

  await exigirSemCaptcha(page)
  const campoCpf = await esperarCampo(page, CAMPO_CPF, "o campo de CPF")
  await campoCpf.fill(cpf)
  if ((await campoCpf.inputValue()).replace(/\D/g, "") !== cpf.replace(/\D/g, "")) {
    throw new LoginManual("o campo de CPF não ficou com o que eu digitei")
  }
  await avancar(page, BOTAO_CPF, "o botão de avançar do CPF")

  // Depois do CPF o gov.br decide o que pedir: senha, captcha, outro
  // fator, ou um aviso. Só o primeiro caso é nosso.
  await exigirSemCaptcha(page)
  const campoSenha = await esperarCampo(page, CAMPO_SENHA, "o campo de senha")
  await exigirNoSSO(page)

  await campoSenha.fill(senha)
  // Confere que entrou sem publicar o tamanho: comprimento de senha em
  // log de terminal é informação que não precisa existir.
  if (!(await campoSenha.inputValue())) {
    throw new LoginManual("o campo de senha ficou vazio depois do preenchimento")
  }
  relato.observado("senha preenchida")

  await avancar(page, BOTAO_SENHA, "o botão de entrar")
  relato.confirmado("credenciais enviadas ao gov.br")
}

/**
 * Entra na conta e devolve.
 *
 * Não confirma o login: quem confirma é o `waitForURL` da área logada,
 * em protocolo.ts, e é bom que seja um só — dois lugares dando login por
 * feito é um a mais para discordar do outro.
 */
export async function entrar(page: Page) {
  const cpf = process.env.PROTOCOLO_CPF
  const senha = process.env.PROTOCOLO_SENHA

  if (!cpf || !senha) {
    await pausaHumana("faça o login no gov.br", [
      "O robô não tem a sua senha nem o seu token A3.",
      "",
      ...INSTRUCOES_MANUAIS,
      "",
      "(Para o robô entrar sozinho, veja PROTOCOLO_CPF e PROTOCOLO_SENHA",
      " em artifacts/workflows/protocolo_assistido_secretaria.md.)",
    ])
    return
  }

  try {
    await automatico(page, cpf, senha)
  } catch (erro) {
    if (!(erro instanceof LoginManual)) throw erro

    relato.alerta(`login automático parou: ${erro.motivo}`)
    await pausaHumana("o login volta a ser seu", [
      erro.motivo + ".",
      "",
      "Isso é esperado de vez em quando — captcha aparece por conta do",
      "gov.br, e o site troca de layout sem avisar. Nada foi perdido:",
      "termine a entrada na janela do navegador.",
      "",
      ...INSTRUCOES_MANUAIS,
    ])
  }
}
