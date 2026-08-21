import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { assistirProtocolo } from "./protocolo"
import { escolherAnalista } from "./escolher-analista"
import { montarCaso } from "./caso"
import type { DadosDoCaso } from "./analista"

/**
 * A porta de entrada pelo terminal.
 *
 * Fica separada do fluxo de propósito: assim o preenchimento pode ser
 * exercitado com uma análise de mentira, contra um site de teste, sem
 * que exista no código de produção nenhum atalho para isso.
 */

const alvo = process.argv[2]

if (!alvo) {
  console.error(
    "\n  uso:\n" +
      "    npm run protocolo -- <id-do-processo>     monta o caso do CRM\n" +
      "    npm run protocolo -- caso.json            usa um arquivo pronto\n" +
      "\n  (modelo de arquivo em scripts/protocolo/caso-exemplo.json)\n"
  )
  process.exit(1)
}

async function carregar(): Promise<DadosDoCaso> {
  const caminho = resolve(process.cwd(), alvo)

  if (alvo.endsWith(".json") && existsSync(caminho)) {
    return JSON.parse(readFileSync(caminho, "utf8")) as DadosDoCaso
  }

  console.log(`\n  Montando o caso do processo ${alvo}…`)
  const caso = await montarCaso(alvo)
  console.log(
    `  ✓ ${caso.cliente} — ${caso.beneficio} — ${caso.documentos.length} documento(s) baixado(s)\n`
  )
  return caso
}

async function principal() {
  // Antes de abrir o navegador e ocupar a pessoa: sem análise não há
  // preenchimento, e descobrir isso no meio do formulário é o pior
  // momento possível.
  const analista = escolherAnalista()
  await assistirProtocolo(await carregar(), analista)
}

principal().catch((erro) => {
  console.error("\n  ✗", erro instanceof Error ? erro.message : erro, "\n")
  process.exit(1)
})
