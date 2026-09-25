// ─────────────────────────────────────────────────────────
// Domínio: busca de tarefas
//
// Com milhares de tarefas guardadas em pastas, abrir uma a uma para
// achar "a da Maria Gardenia" não é trabalho, é arqueologia. A busca
// olha título, texto, pasta e responsável de uma vez.
//
// Pensada para como o escritório digita: sem acento ("concessao" acha
// "CONCESSÃO"), sem pontuação no CPF ("02311510126" acha
// "023.115.101-26") e com várias palavras valendo juntas ("maria 1551"
// acha a tarefa que tem as duas, em qualquer ordem).
// ─────────────────────────────────────────────────────────

export type TarefaBuscavel = {
  titulo: string
  descricao?: string | null
  pasta?: string | null
  responsavel?: { name: string } | null
}

export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

function soDigitos(texto: string) {
  return texto.replace(/\D/g, "")
}

/** Palavras da busca, já normalizadas. Vazio quando não há o que buscar. */
export function termosDaBusca(busca: string) {
  return normalizar(busca).split(/\s+/).filter(Boolean)
}

function textoDe(t: TarefaBuscavel) {
  return [t.titulo, t.pasta, t.responsavel?.name, t.descricao].filter(Boolean).join("\n")
}

/**
 * Todas as palavras precisam aparecer. Palavra com número (CPF, NB,
 * processo) também vale comparada só pelos dígitos — quem cola um CPF
 * nunca sabe se ele foi escrito com ponto.
 */
export function tarefaCombina(t: TarefaBuscavel, termos: string[]) {
  if (termos.length === 0) return true
  const texto = normalizar(textoDe(t))
  const digitos = soDigitos(texto)

  return termos.every((termo) => {
    if (texto.includes(termo)) return true
    const d = soDigitos(termo)
    return d.length >= 4 && d.length === termo.replace(/[.\-/]/g, "").length && digitos.includes(d)
  })
}

/**
 * O pedaço do texto onde a busca bateu, para o cartão mostrar por que
 * apareceu quando o título não diz — o CPF costuma estar no meio da
 * descrição.
 */
export function trechoDaBusca(t: TarefaBuscavel, termos: string[], largura = 70) {
  if (termos.length === 0 || !t.descricao) return null
  const titulo = normalizar(t.titulo)
  if (termos.every((termo) => titulo.includes(termo))) return null

  const original = t.descricao.replace(/\s+/g, " ")
  const alvo = normalizar(original)
  // A frase inteira primeiro: "concessao processada" deve cair no
  // "CONCESSÃO PROCESSADA" do texto, não no nome de um anexo que por
  // acaso tem "concessao" antes.
  let pos = alvo.indexOf(termos.join(" "))
  const termo = termos.find((x) => !titulo.includes(x)) ?? termos[0]
  if (pos === -1) pos = alvo.indexOf(termo)
  if (pos === -1) {
    // Bateu pelos dígitos: acha o primeiro dígito da sequência.
    const d = soDigitos(termo)
    if (!d) return null
    pos = alvo.search(new RegExp(d.split("").join("\\D?")))
    if (pos === -1) return null
  }

  // Pouco contexto antes: a coluna é estreita, e o que importa é o que
  // vem depois de onde bateu.
  const inicio = Math.max(0, pos - 12)
  const fim = Math.min(original.length, inicio + largura)
  return `${inicio > 0 ? "…" : ""}${original.slice(inicio, fim).trim()}${fim < original.length ? "…" : ""}`
}
