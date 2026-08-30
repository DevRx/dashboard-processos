import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/server"

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
 * Esta rota responde a pergunta que aquele 500 não respondia. Não
 * substitui o log; serve para quem está diante de um deploy quebrado e
 * precisa saber, em cinco segundos, qual das três coisas olhar.
 *
 * ── Sobre não exigir login ────────────────────────────────────────
 * Exigir sessão aqui a tornaria inútil justamente quando ela importa:
 * quando o login é o que está quebrado. O preço é ela ficar aberta,
 * então ela não diz nada que ajude alguém de fora — só "configurada"
 * ou "faltando", nunca um valor, nunca um endereço, nunca a mensagem
 * crua do banco (que carrega host e nome de projeto). Quem já sabia
 * que o site existe não aprende nada além de que ele está mal
 * configurado, o que a tela de erro já entregava.
 */

/** Colunas que uma migration recente trouxe. Ver supabase/migrations/. */
const EXIGIDAS = [
  { tabela: "tarefas", coluna: "tipo", migration: "20260830180000_duvidas_e_historico" },
  { tabela: "eventos_tarefa", coluna: "id", migration: "20260830180000_duvidas_e_historico" },
] as const

type Achado = { nome: string; ok: boolean; detalhe: string }

export async function GET() {
  const achados: Achado[] = []

  // As três obrigatórias. Hoje a build quebra sem elas (ver
  // lib/supabase/server.ts e lib/session.ts), então aqui é confirmação,
  // não descoberta — mas confirmação vale quando o resto está estranho.
  for (const nome of [
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SESSION_SECRET",
  ]) {
    achados.push({
      nome,
      ok: Boolean(process.env[nome]),
      detalhe: process.env[nome] ? "configurada" : "FALTANDO",
    })
  }

  // Opcionais: sem elas o sistema roda, com pedaços desligados.
  for (const [nome, oQueDesliga] of [
    ["SENHA_INSS_KEY", "cofre usa SESSION_SECRET como chave"],
    ["ANTHROPIC_API_KEY", "leitura de laudo e triagem por IA desligadas"],
    ["DJEN_CRON_SECRET", "rotina automática do DJEN não roda"],
  ] as const) {
    achados.push({
      nome,
      ok: true,
      detalhe: process.env[nome] ? "configurada" : `ausente — ${oQueDesliga}`,
    })
  }

  // O banco responde? Uma consulta barata, que não lê dado de cliente.
  let bancoOk = false
  try {
    // `.limit(1)` e não `head: true`: com `head` o supabase-js engole o
    // 404 de tabela inexistente e devolve status 204 com `error` nulo —
    // o diagnóstico dizia "presente" para tabela que não existe, que é
    // o único defeito que uma tela de diagnóstico não pode ter.
    const { error } = await supabase.from("users").select("id").limit(1)
    bancoOk = !error
    achados.push({
      nome: "conexão com o Supabase",
      ok: bancoOk,
      // A mensagem crua carrega host e nome do projeto: fica no log.
      detalhe: bancoOk ? "responde" : "NÃO RESPONDE — ver o log do deploy",
    })
    if (error) console.error("Saúde — Supabase:", error.message)
  } catch (erro) {
    achados.push({
      nome: "conexão com o Supabase",
      ok: false,
      detalhe: "NÃO RESPONDE — ver o log do deploy",
    })
    console.error("Saúde — Supabase:", erro)
  }

  // O schema está em dia? É a pergunta que o 500 por coluna inexistente
  // nunca respondeu — e migration aplicada à mão é fácil de esquecer.
  if (bancoOk) {
    for (const { tabela, coluna, migration } of EXIGIDAS) {
      const { error } = await supabase.from(tabela).select(coluna).limit(1)

      achados.push({
        nome: `${tabela}.${coluna}`,
        ok: !error,
        detalhe: error ? `FALTANDO — aplique ${migration}.sql` : "presente",
      })
    }
  }

  const saudavel = achados.every((a) => a.ok)

  return NextResponse.json(
    {
      saudavel,
      resumo: saudavel
        ? "Tudo que o sistema precisa está no lugar."
        : "Há pendências — veja abaixo o que está FALTANDO.",
      achados,
    },
    // 503 e não 200: assim um monitor externo enxerga o problema sem
    // precisar entender o corpo da resposta.
    { status: saudavel ? 200 : 503 }
  )
}
