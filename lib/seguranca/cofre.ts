import "server-only"
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto"

/**
 * Cofre para segredos operacionais do escritório — hoje, a senha do
 * Meu INSS do titular.
 *
 * A senha precisa voltar em claro (a equipe entra no gov.br com ela),
 * então hash não serve: é cifra reversível. AES-256-GCM porque a tag
 * de autenticação denuncia adulteração do texto cifrado — sem ela, um
 * banco comprometido poderia devolver lixo decifrável.
 *
 * A chave sai de `SENHA_INSS_KEY` quando existe; senão é derivada do
 * `SESSION_SECRET`. Trocar qualquer uma das duas torna ilegível o que
 * já estava guardado — as senhas precisam ser redigitadas.
 */

const ROTULO = "v1"

function chave(): Buffer {
  const dedicada = process.env.SENHA_INSS_KEY
  if (dedicada) return scryptSync(dedicada, "senha-meu-inss", 32)

  const sessao = process.env.SESSION_SECRET
  if (!sessao) {
    throw new Error(
      "Defina SENHA_INSS_KEY (ou ao menos SESSION_SECRET) para guardar a senha do Meu INSS"
    )
  }
  return scryptSync(sessao, "senha-meu-inss", 32)
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", chave(), iv)
  const dados = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()])

  return [
    ROTULO,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    dados.toString("base64"),
  ].join(".")
}

/**
 * Devolve `null` quando o pacote não abre — chave trocada, valor
 * gravado antes desta versão ou adulterado. A tela trata isso como
 * "senha não cadastrada", que é a leitura honesta: ninguém consegue
 * usar aquele valor.
 */
export function decifrar(pacote: string): string | null {
  const partes = pacote.split(".")
  if (partes.length !== 4 || partes[0] !== ROTULO) return null

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      chave(),
      Buffer.from(partes[1], "base64")
    )
    decipher.setAuthTag(Buffer.from(partes[2], "base64"))

    return Buffer.concat([
      decipher.update(Buffer.from(partes[3], "base64")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }
}
