import type { LeituraDocumento } from "@/lib/ia/leitor-documento"

/**
 * Triagem em texto corrido, para chegar no celular.
 *
 * Existe separado da leitura porque o destino manda no formato: o
 * WhatsApp não renderiza markdown nem tabela, quebra linha longa de
 * jeito imprevisível e é lido com o polegar, em pé, entre uma coisa e
 * outra. O que serve na tela do CRM não serve aqui.
 *
 * Sem markdown de propósito — `**negrito**` chega literal. O WhatsApp
 * usa asterisco simples.
 */

const ROTULO_INCAPACIDADE: Record<string, string> = {
  TEMPORARIA: "temporária",
  PERMANENTE: "permanente",
  NAO_CARACTERIZADA: "não caracterizada",
  NAO_INFORMADA: "não informada no laudo",
}

const ROTULO_ALCANCE: Record<string, string> = {
  TOTAL: "total",
  PARCIAL: "parcial",
  NAO_INFORMADO: "alcance não informado",
}

function dataBr(iso?: string): string | null {
  if (!iso) return null
  return iso.slice(0, 10).split("-").reverse().join("/")
}

/**
 * Monta a mensagem. `nomeCliente` é passado pelo chamador e não vem da
 * leitura: o modelo é instruído a nunca transcrever o nome do titular,
 * e quem manda a mensagem já sabe de quem é o caso.
 */
export function mensagemWhatsApp(
  leitura: LeituraDocumento,
  contexto: { cliente?: string; arquivo?: string }
): string {
  const { triagem, validade, pontosFracos } = leitura
  const linhas: string[] = []

  linhas.push("*Triagem de laudo*")
  if (contexto.cliente) linhas.push(contexto.cliente)
  linhas.push("")

  const titulo = [triagem.patologia, triagem.cid && `CID ${triagem.cid}`]
    .filter(Boolean)
    .join(" — ")
  if (titulo) linhas.push(titulo)

  linhas.push(
    `Incapacidade: ${ROTULO_INCAPACIDADE[triagem.incapacidade] ?? "—"}` +
      (triagem.alcance !== "NAO_INFORMADO"
        ? `, ${ROTULO_ALCANCE[triagem.alcance]}`
        : "")
  )

  // O nexo decide entre acidentário e previdenciário; só aparece
  // quando o laudo diz algo, para não virar linha de ruído.
  if (triagem.nexoOcupacional !== "NAO_INFORMADO") {
    linhas.push(
      triagem.nexoOcupacional === "SIM"
        ? "Nexo ocupacional: sim (avaliar espécie acidentária)"
        : "Nexo ocupacional: não"
    )
  }

  const dii = dataBr(triagem.dataInicioIncapacidade)
  const did = dataBr(triagem.dataInicioDoenca)
  if (dii) linhas.push(`DII: ${dii}`)
  else if (did) linhas.push(`DID: ${did} (DII não declarada)`)

  if (triagem.diasAfastamento) {
    linhas.push(`Afastamento: ${triagem.diasAfastamento} dias`)
  }

  if (leitura.beneficioSugerido) {
    linhas.push(`Sugere: ${leitura.beneficioSugerido}`)
  }

  // Vício de forma derruba o laudo por melhor que seja o conteúdo —
  // por isso vem antes dos pontos fracos de mérito.
  const faltando = [
    !validade.temAssinatura && "assinatura",
    !validade.temCarimbo && "carimbo",
    !validade.crmLegivel && "CRM legível",
    !validade.temData && "data",
  ].filter((v): v is string => Boolean(v))

  if (faltando.length > 0) {
    linhas.push("")
    // "Faltando:" e não "Sem ...": o prefixo precisa funcionar com
    // qualquer combinação de rótulos, e "Sem CRM legível" lê ao
    // contrário do que quer dizer.
    linhas.push(`⚠️ Faltando: ${faltando.join(", ")} — risco de recusa por forma`)
  }

  if (pontosFracos.length > 0) {
    linhas.push("")
    linhas.push("Pontos fracos:")
    for (const ponto of pontosFracos) linhas.push(`• ${ponto}`)
  }

  if (leitura.ilegivel.length > 0) {
    linhas.push("")
    linhas.push(`Não deu para ler: ${leitura.ilegivel.join(", ")}`)
  }

  linhas.push("")
  if (contexto.arquivo) linhas.push(contexto.arquivo)
  linhas.push("_Leitura automática — confira antes de usar._")

  return linhas.join("\n")
}
