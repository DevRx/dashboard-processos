import * as readline from "node:readline/promises"

/**
 * O canal com o humano.
 *
 * Num robô totalmente automático o terminal é log. Aqui ele é a
 * interface pela qual alguém decide protocolar ou não em nome de um
 * cliente — então cada parada precisa ser impossível de passar batido, e
 * cada confirmação precisa ser explícita. "Enter para continuar" não
 * serve: o dedo já está no Enter.
 */

/**
 * Uma interface só, viva do começo ao fim.
 *
 * Abrir e fechar um `readline` por pergunta perde o que já estava no
 * buffer entre uma e outra — some com respostas quando a entrada não é
 * um terminal interativo (um roteiro de teste, um pipe). Uma instância
 * compartilhada também garante que o Ctrl-C continue funcionando.
 */
let interfaceAberta: readline.Interface | null = null
let entradaEncerrada = false

/** A entrada acabou (Ctrl-D, pipe fechado). Não é falha do site. */
export class EntradaEncerrada extends Error {
  constructor() {
    super("a entrada do terminal foi encerrada antes de a resposta chegar")
    this.name = "EntradaEncerrada"
  }
}

/**
 * Ensaio: respostas roteirizadas, para exercitar o fluxo inteiro sem
 * ninguém digitando.
 *
 * Existe para ensaiar contra um site de teste. Fica travado quando o
 * alvo é o Meu INSS de verdade — confirmação automática em cima de dado
 * de cliente é exatamente o que este script se recusa a fazer.
 */
function respostasDeEnsaio(): string[] | null {
  const roteiro = process.env.PROTOCOLO_RESPOSTAS
  if (!roteiro) return null

  const alvo = process.env.PROTOCOLO_URL ?? ""
  if (!alvo || /(^|\.)inss\.gov\.br/i.test(alvo)) {
    throw new Error(
      "PROTOCOLO_RESPOSTAS só vale em ensaio contra site de teste. " +
        "Contra o Meu INSS as confirmações são digitadas por uma pessoa."
    )
  }

  // vírgula separa; "-" é uma linha vazia (só ENTER)
  return roteiro.split(",").map((r) => (r === "-" ? "" : r))
}

const roteiro = respostasDeEnsaio()
let proximaResposta = 0

function terminal() {
  if (!interfaceAberta) {
    interfaceAberta = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    interfaceAberta.on("close", () => {
      entradaEncerrada = true
    })
  }
  return interfaceAberta
}

/** Uma pergunta ao operador — ou ao roteiro, quando é ensaio. */
async function perguntar(texto: string): Promise<string> {
  if (roteiro) {
    const resposta = roteiro[proximaResposta++] ?? ""
    console.log(`${texto}${resposta || "(enter)"}   [ensaio]`)
    return resposta
  }

  if (entradaEncerrada) throw new EntradaEncerrada()

  try {
    return await terminal().question(texto)
  } catch (erro) {
    if (erro instanceof Error && /closed/i.test(erro.message)) {
      throw new EntradaEncerrada()
    }
    throw erro
  }
}

/** Chamar uma vez, no fim de tudo — senão o processo não encerra. */
export function fecharTerminal() {
  interfaceAberta?.close()
  interfaceAberta = null
}

const LARGURA = 68
const linha = (c: string) => c.repeat(LARGURA)

export function bloco(titulo: string, corpo: string[]) {
  console.log("\n" + linha("═"))
  console.log("  " + titulo.toUpperCase())
  console.log(linha("─"))
  for (const l of corpo) console.log("  " + l)
  console.log(linha("═"))
}

/** Passo que o robô não faz — quem faz é a pessoa. */
export async function pausaHumana(titulo: string, instrucoes: string[]) {
  bloco(`⏸  pare — ${titulo}`, instrucoes)
  await perguntar("\n  Quando terminar, digite ENTER para o robô continuar… ")
}

/**
 * Porta de decisão. O padrão é NÃO: quem quiser seguir digita a palavra
 * inteira. Um Enter distraído não avança nada que toque no INSS.
 */
export async function confirmar(pergunta: string, palavra = "sim"): Promise<boolean> {
  const dito = await perguntar(
    `\n  ${pergunta}\n  Digite "${palavra}" para confirmar (qualquer outra coisa cancela): `
  )
  return dito.trim().toLowerCase() === palavra
}

/**
 * Relato honesto de um passo.
 *
 * `tentando` sai antes da ação; `confirmado` só sai depois da verificação
 * passar. A versão anterior deste script anunciava "inserindo
 * observações" e em seguida morria — quem lesse o terminal concluiria que
 * o campo estava preenchido. Aqui nada é dado por feito sem prova.
 */
export const relato = {
  tentando: (o: string) => console.log(`  → ${o}…`),
  confirmado: (o: string) => console.log(`  ✓ ${o}`),
  observado: (o: string) => console.log(`    · ${o}`),
  alerta: (o: string) => console.log(`  ⚠ ${o}`),
  falhou: (o: string) => console.log(`  ✗ ${o}`),
}
