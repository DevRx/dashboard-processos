import { NextResponse } from "next/server"
import { diagnosticar } from "@/lib/saude"

/**
 * O que está faltando para este deploy funcionar.
 *
 * Existe por causa de um dia específico: o sistema subiu verde na
 * Vercel, todas as telas carregaram, e ninguém conseguiu entrar. A
 * resposta era "erro interno do servidor" — a mesma frase para
 * variável de ambiente faltando, banco fora do ar e coluna que a
 * migration não criou. Três problemas distintos, uma única frase, e
 * nenhuma pista de qual deles era.
 *
 * As checagens moram em lib/saude.ts — o conector do Claude usa as
 * mesmas (ferramenta `saude_do_sistema`) para avisar quando algo cai.
 *
 * ── Sobre não exigir login ────────────────────────────────────────
 * Exigir sessão aqui a tornaria inútil justamente quando ela importa:
 * quando o login é o que está quebrado. O preço é ela ficar aberta,
 * então ela não diz nada que ajude alguém de fora — só "configurada"
 * ou "faltando", nunca um valor, nunca um endereço, nunca a mensagem
 * crua do banco (que carrega host e nome de projeto).
 */
export async function GET() {
  const diagnostico = await diagnosticar()
  // 503 e não 200: assim um monitor externo enxerga o problema sem
  // precisar entender o corpo da resposta.
  return NextResponse.json(diagnostico, { status: diagnostico.saudavel ? 200 : 503 })
}
