import { MUNICIPIOS, type Municipio } from "./municipios"

export { MUNICIPIOS }
export type { Municipio }

/** Tira acento e caixa: "Águas Claras" e "aguas claras" viram o mesmo. */
function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

/**
 * Índice pré-normalizado, do nome mais longo para o mais curto.
 *
 * O comprimento importa: "Planaltina de Goiás" contém "Planaltina", e
 * um endereço goiano cairia no DF se o mais curto fosse testado antes.
 * Mesma história com "Riacho Fundo II" e "Sobradinho II".
 */
const INDICE = [...MUNICIPIOS]
  .map((m) => ({ municipio: m, alvo: normalizar(m.nome) }))
  .sort((a, b) => b.alvo.length - a.alvo.length)

/**
 * Reconhece o município escrito num endereço livre.
 *
 * Quando o endereço traz a UF, ela desempata: "Planaltina - GO" não
 * pode virar a Planaltina do DF só porque o nome apareceu primeiro.
 */
export function municipioDoEndereco(endereco?: string | null): Municipio | null {
  if (!endereco?.trim()) return null

  const texto = normalizar(endereco)
  const ufNoTexto = texto.match(/\b(a[clpm]|ba|ce|df|es|go|m[agst]|p[abeir]|r[jnors]|s[cep]|to)\b/)?.[1]

  const candidatos = INDICE.filter((i) => texto.includes(i.alvo))
  if (candidatos.length === 0) return null

  if (ufNoTexto) {
    const daUf = candidatos.find(
      (c) => c.municipio.uf.toLowerCase() === ufNoTexto
    )
    if (daUf) return daUf.municipio

    // "Planaltina - GO" traz só "Planaltina", que casa com a do DF. Se
    // existe um município daquela UF cujo nome começa igual — Planaltina
    // de Goiás —, é dele que o endereço está falando.
    const homonimo = INDICE.find(
      (i) =>
        i.municipio.uf.toLowerCase() === ufNoTexto &&
        i.alvo.startsWith(candidatos[0].alvo)
    )
    if (homonimo) return homonimo.municipio
  }

  return candidatos[0].municipio
}

/**
 * Caminho de volta: a coordenada gravada à mão é sempre a de um
 * município desta tabela, então dá para recuperar o nome dele em vez
 * de mostrar um par de números no painel.
 *
 * A tolerância cobre o arredondamento de ida e volta pelo banco, e é
 * menor que a distância entre quaisquer dois municípios da lista.
 */
export function municipioPorCoordenada(
  lat: number,
  lng: number
): Municipio | null {
  const TOLERANCIA = 0.0005

  return (
    MUNICIPIOS.find(
      (m) =>
        Math.abs(m.lat - lat) < TOLERANCIA && Math.abs(m.lng - lng) < TOLERANCIA
    ) ?? null
  )
}

export function municipioPorNome(nome: string, uf: string): Municipio | null {
  const alvo = normalizar(nome)
  return (
    MUNICIPIOS.find((m) => normalizar(m.nome) === alvo && m.uf === uf) ?? null
  )
}
