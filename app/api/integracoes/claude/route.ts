import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { getCurrentUser } from "@/lib/auth"
import { novaChave } from "@/lib/chaves"
import { supabase } from "@/lib/supabase/server"

/**
 * Configurações › Conectar o Claude — só o administrador.
 *
 * GET: a conta do Claude (se já existe) e as chaves do conector.
 * POST { acao: "gerar" }: cria a conta "Claude" se ainda não houver e
 *   gera uma chave para ela. A chave volta UMA vez, nesta resposta; no
 *   banco fica só o resumo.
 * POST { acao: "revogar", id }: a chave para de funcionar na hora.
 *
 * A conta do Claude é uma conta da equipe como as outras: é por ela que
 * as etapas com "Claude" no desenho acham o responsável, e é o nome
 * dela que aparece no histórico do que ele fizer. A senha é aleatória e
 * não é mostrada a ninguém — ninguém entra na tela com essa conta.
 */

const EMAIL_DO_CLAUDE = "claude@assistente.local"

type ErroBanco = { code?: string; message?: string } | null

function semTabela(e: ErroBanco) {
  return Boolean(e && (e.code === "42P01" || e.code === "PGRST205" || /chaves_api/.test(e.message ?? "")))
}

const MENSAGEM_SEM_TABELA =
  "Falta rodar no Supabase a migration 20261014110000_chaves_api.sql (a tabela das chaves do conector)."

async function contaDoClaude() {
  const { data } = await supabase.from("users").select("id, name, email").order("created_at", { ascending: true })
  const lista = (data ?? []) as { id: string; name: string; email: string }[]
  const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  return lista.find((u) => semAcento(u.name) === "claude") ?? lista.find((u) => u.email === EMAIL_DO_CLAUDE) ?? null
}

async function exigirAdmin() {
  const user = await getCurrentUser()
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  if (user.role !== "ADMIN") {
    return { erro: NextResponse.json({ error: "Só o administrador conecta o Claude" }, { status: 403 }) }
  }
  return { user }
}

export async function GET() {
  const { user, erro } = await exigirAdmin()
  if (!user) return erro

  const conta = await contaDoClaude()
  const { data, error } = await supabase
    .from("chaves_api")
    .select("id, nome, prefixo, criada_em, ultimo_uso_em, revogada_em, usuario:users!chaves_api_usuario_id_fkey(name)")
    .order("criada_em", { ascending: false })

  if (error) {
    if (semTabela(error)) return NextResponse.json({ tabelaPronta: false, aviso: MENSAGEM_SEM_TABELA, conta, chaves: [] })
    console.error("Chaves do conector:", error.message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }

  const chaves = (data ?? []).map((c) => {
    const usuario = Array.isArray(c.usuario) ? c.usuario[0] : c.usuario
    return {
      id: c.id,
      nome: c.nome,
      prefixo: c.prefixo,
      criadaEm: c.criada_em,
      ultimoUsoEm: c.ultimo_uso_em,
      revogadaEm: c.revogada_em,
      conta: usuario?.name ?? null,
    }
  })
  return NextResponse.json({ tabelaPronta: true, conta, chaves })
}

const PedidoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("gerar"), nome: z.string().trim().min(1).max(80).optional() }),
  z.object({ acao: z.literal("revogar"), id: z.guid() }),
])

export async function POST(request: NextRequest) {
  const { user, erro } = await exigirAdmin()
  if (!user) return erro

  const pedido = PedidoSchema.safeParse(await request.json().catch(() => null))
  if (!pedido.success) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 })

  if (pedido.data.acao === "revogar") {
    const { error } = await supabase
      .from("chaves_api")
      .update({ revogada_em: new Date().toISOString() })
      .eq("id", pedido.data.id)
      .is("revogada_em", null)
    if (error) {
      if (semTabela(error)) return NextResponse.json({ error: MENSAGEM_SEM_TABELA }, { status: 503 })
      console.error("Revogar chave:", error.message)
      return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // Confere a tabela antes de criar a conta: sem ela, a conta nasceria
  // sem chave nenhuma.
  const { error: erroTabela } = await supabase.from("chaves_api").select("id").limit(1)
  if (erroTabela) {
    if (semTabela(erroTabela)) return NextResponse.json({ error: MENSAGEM_SEM_TABELA }, { status: 503 })
    console.error("Chaves do conector:", erroTabela.message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }

  let conta = await contaDoClaude()
  let contaCriada = false
  if (!conta) {
    const senha = await bcrypt.hash(randomBytes(32).toString("base64url"), 10)
    const { data, error } = await supabase
      .from("users")
      .insert({ name: "Claude", email: EMAIL_DO_CLAUDE, password: senha, role: "ASSISTENTE" })
      .select("id, name, email")
      .single()
    if (error || !data) {
      console.error("Conta do Claude:", error?.message)
      return NextResponse.json({ error: "Não foi possível criar a conta do Claude" }, { status: 500 })
    }
    conta = data
    contaCriada = true
  }

  const { chave, hash, prefixo } = novaChave()
  const { error } = await supabase.from("chaves_api").insert({
    usuario_id: conta.id,
    nome: pedido.data.nome ?? "Conector do Claude",
    prefixo,
    hash,
    criada_por: user.id,
  })
  if (error) {
    console.error("Gerar chave:", error.message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }

  return NextResponse.json({ chave, prefixo, conta, contaCriada }, { status: 201 })
}
