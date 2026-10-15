/**
 * Teste de estresse: todas as operações do sistema acontecendo ao
 * mesmo tempo, com cada vez mais gente, até achar o teto.
 *
 * Três perguntas, três partes:
 *
 *   1. ANATOMIA — quanto custa cada clique? Para cada operação que o
 *      sistema tem (telas, ações do fluxo, edições, dúvidas, processos,
 *      clientes, intimações, configurações, o conector do Claude),
 *      conta quantas idas ao banco ela faz e quantos bytes volta. Em
 *      produção (Vercel + Supabase) cada ida é uma viagem pela rede —
 *      é o número que decide a velocidade.
 *
 *   2. TUDO AO MESMO TEMPO — a equipe inteira, com tela aberta,
 *      clicando em tudo: concluir, mover, atribuir, criar, apagar,
 *      editar, abrir e responder dúvida, mexer em processo e cliente,
 *      tratar intimação, o Claude pelo conector, admin ligando a trava
 *      e trazendo tarefas em lote. Em rampa: 16 → 48 → 96 → 192 → 384
 *      pessoas, um tanto de segundos por nível, medindo p50/p95/p99 de
 *      clique e de tela, erros e vazão. O teto é o primeiro nível em
 *      que o p95 do clique passa de 2 s ou os erros passam de 1%.
 *
 *   3. O BANCO CONTINUA CERTO? — depois de tudo, as invariantes do
 *      fluxo (comum.ts) e as consultas mais caras (pg_stat_statements).
 *
 * Uso (com o app em produção local, o gateway com /__contagem e o
 * banco de teste no ar):
 *
 *   BASE=http://127.0.0.1:3123 DATABASE_URL=postgres://… SESSION_SECRET=… \
 *   GATEWAY=http://127.0.0.1:54322 \
 *     npx tsx scripts/teste-fluxo/estresse.ts [tarefas=4000] [segundos/nível=30] [níveis=16,48,96,192,384]
 *
 * NÃO rode contra o banco de produção.
 */
import { createHash } from "node:crypto"
import { writeFileSync } from "node:fs"
import { execSync } from "node:child_process"
import bcrypt from "bcryptjs"

import {
  U,
  EQUIPE,
  db,
  chamar,
  acaso,
  sortear,
  amostra,
  confere,
  percentil,
  falhas,
  verificacoes,
  erros5xx,
  statusPorOp,
  tempos,
  zerarMedidas,
  TODAS_ETAPAS,
  lugarDe,
  hoje,
  semear,
  listaDaTela,
  invariantes,
  acao,
  tabelaDeTempos,
  encerrar,
  type Pessoa,
  type TarefaApi,
} from "./comum"
import { gruposDa, atribuicoesDa, TIMES_TAREFA } from "../../lib/domain/tarefa"

const GATEWAY = process.env.GATEWAY ?? "http://127.0.0.1:54322"
const N_TAREFAS = Number(process.argv[2] ?? 4000)
const SEGUNDOS = Number(process.argv[3] ?? 30)
const NIVEIS = (process.argv[4] ?? "16,48,96,192,384").split(",").map(Number)
const SAIDA = process.env.SAIDA ?? "/tmp/estresse-resultado.json"

const CHAVE_MCP = "dp_teste_estresse_0123456789abcdef0123456789abcdef"

// ── Idas ao banco (contador do gateway) ───────────────────

type Contagem = { total: number; ms: number; bytes: number; porRota: Record<string, { n: number; ms: number; bytes: number }> }
async function contagem(zerar = false): Promise<Contagem> {
  const r = await fetch(`${GATEWAY}/__contagem${zerar ? "?zerar=1" : ""}`).catch(() => null)
  return r ? ((await r.json()) as Contagem) : { total: 0, ms: 0, bytes: 0, porRota: {} }
}

// ── O conector do Claude ──────────────────────────────────

let idRpc = 0
async function mcp(ferramenta: string, argumentos: Record<string, unknown>, op = `mcp ${ferramenta}`) {
  const r = await chamar(op, null, "POST", `/api/mcp/${CHAVE_MCP}`, {
    jsonrpc: "2.0",
    id: ++idRpc,
    method: "tools/call",
    params: { name: ferramenta, arguments: argumentos },
  }, { headers: { accept: "application/json, text/event-stream" } })
  const result = r.corpo.result as { content?: { text?: string }[]; isError?: boolean } | undefined
  let dados: Record<string, unknown> = {}
  try {
    dados = JSON.parse(result?.content?.[0]?.text ?? "{}") as Record<string, unknown>
  } catch {
    dados = {}
  }
  return { ...r, dados, erroFerramenta: Boolean(result?.isError) }
}

// ── Estado compartilhado da rodada ────────────────────────

type Estado = {
  tarefas: Map<string, TarefaApi>
  ids: string[]
  duvidasAbertas: string[]
  processos: string[]
  clientes: string[]
  intimacoes: string[]
  criadas: number
}
const estado: Estado = { tarefas: new Map(), ids: [], duvidasAbertas: [], processos: [], clientes: [], intimacoes: [], criadas: 0 }

function tarefaAoAcaso() {
  for (let i = 0; i < 5; i++) {
    const id = sortear(estado.ids)
    const t = estado.tarefas.get(id)
    if (t) return t
  }
  return null
}
function grupoDe(t: TarefaApi) {
  const grupos = gruposDa(atribuicoesDa({ ...t, atribuicoes: t.atribuicoes ?? [] }))
  return grupos.length ? sortear(grupos) : null
}
function lembrar(r: { status: number; corpo: Record<string, unknown> }, id: string) {
  if (r.status === 200 && r.corpo.tarefa) {
    const nova = r.corpo.tarefa as TarefaApi
    if (nova.status === "CONCLUIDA" || nova.status === "CANCELADA") estado.tarefas.set(id, { ...nova, atribuicoes: [] })
    else estado.tarefas.set(id, nova)
  }
}
function esquecer(id: string) {
  estado.tarefas.delete(id)
}

// ── Preparação ────────────────────────────────────────────

async function preparar() {
  const ids = await semear(N_TAREFAS)
  console.log(`• ${ids.length} tarefas semeadas`)

  // Chave do conector para o Claude.
  await db.query(`delete from chaves_api where usuario_id = $1`, [U.claude.id])
  await db.query(
    `insert into chaves_api (usuario_id, nome, prefixo, hash, criada_por) values ($1, 'teste de estresse', $2, $3, $1)`,
    [U.claude.id, CHAVE_MCP.slice(0, 12), createHash("sha256").update(CHAVE_MCP, "utf8").digest("hex")]
  )
  // Senha de verdade para o Zeca, para medir o login.
  await db.query(`update users set password = $2 where id = $1`, [U.zeca.id, await bcrypt.hash("senha-do-teste", 10)])

  // Clientes e processos para as operações de cadastro.
  for (let i = 0; i < 30; i++) {
    const c = await chamar("POST cliente", U.tay, "POST", "/api/clientes", {
      nome: `ESTRESSE CLIENTE ${String(i).padStart(3, "0")}`,
      cpf: `9${String(i).padStart(2, "0")}.000.000-0${i % 10}`,
      telefone: `(61) 9${String(80000000 + i)}`,
    })
    const cliente = (c.corpo.cliente ?? c.corpo) as { id?: string }
    if (cliente?.id) estado.clientes.push(cliente.id)
  }
  for (let i = 0; i < 30; i++) {
    const p = await chamar("POST processo", U.gui, "POST", "/api/processos", {
      clienteId: sortear(estado.clientes),
      beneficio: sortear(["BPC/LOAS", "Auxílio por incapacidade temporária", "Aposentadoria por idade", "Salário-maternidade", "Pensão por morte"]),
      esfera: i % 2 ? "JUDICIAL" : "ADMINISTRATIVO",
      numero: i % 2 ? `1${String(100000 + i)}-00.2026.4.01.3400` : undefined,
      observacoes: `ESTRESSE processo ${i}`,
    })
    const processo = (p.corpo.processo ?? p.corpo) as { id?: string }
    if (processo?.id) estado.processos.push(processo.id)
  }
  console.log(`• ${estado.clientes.length} clientes e ${estado.processos.length} processos de teste`)

  // Intimações com perícia, para o mutirão e o tratamento.
  const em12 = new Date(Date.now() + 12 * 86400000)
  while (em12.getUTCDay() === 0 || em12.getUTCDay() === 6) em12.setUTCDate(em12.getUTCDate() + 1)
  const dataPericia = em12.toISOString().slice(0, 10)
  for (let i = 0; i < 40; i++) {
    const r = await db.query(
      `insert into comunicacoes_djen (user_id, djen_id, data_disponibilizacao, texto, numero_processo_mascara, destinatario, processo_id, prazo_estimado, prazo_dias, ia_evento_tipo, ia_evento_data, ia_evento_hora, ia_evento_local, ia_tipo_ato, ia_providencia)
       values ($1, $2, current_date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Intimação', 'Providenciar') returning id`,
      [
        U.zeca.id,
        920000000 + i,
        i % 3 === 0 ? "fica designada perícia médica para o dia " + dataPericia : "intime-se a parte autora para, no prazo de 15 dias, manifestar-se",
        `1${String(200000 + i)}-00.2026.4.01.3400`,
        `ESTRESSE CLIENTE ${String(i % 30).padStart(3, "0")}`,
        i % 2 ? sortear(estado.processos) : null,
        i % 3 === 0 ? null : new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        i % 3 === 0 ? null : 15,
        i % 3 === 0 ? "PERICIA" : null,
        i % 3 === 0 ? dataPericia : null,
        i % 3 === 0 ? "14:00" : null,
        i % 3 === 0 ? "Central de Perícias" : null,
      ]
    )
    estado.intimacoes.push(r.rows[0].id)
  }

  // Tudo dentro do fluxo antes de começar.
  const sync = await chamar("POST trazer", U.zeca, "POST", "/api/tarefas/fluxo")
  console.log(`• ${sync.corpo.linhas ?? "?"} partes gravadas ao trazer tudo para o fluxo`)

  for (const t of await listaDaTela()) estado.tarefas.set(t.id, t)
  estado.ids = [...estado.tarefas.keys()]
  console.log(`• ${estado.ids.length} cartões abertos na tela`)
}

// ── Catálogo de operações ─────────────────────────────────
//
// Cada operação é o que uma pessoa faz com um clique (ou o que a tela
// pede ao abrir). `peso` é a frequência na mistura; `tipo` separa o
// que é tela (leitura) do que é clique (gravação) no relatório.

type Op = { nome: string; tipo: "tela" | "clique"; peso: number; quem?: Pessoa; fn: (quem: Pessoa) => Promise<unknown> }

const LISTA = "/api/tarefas?abertas=1&vinculos=1&atribuicoes=1"

/**
 * A recarga que a tela faz depois de uma ação recusada: desde 15/10 ela
 * pede só o que mudou (`desde` = o `agora` da última leitura). Sem a
 * função no banco, o servidor manda tudo, como antes — o teste mede o
 * que o servidor devolver.
 */
let agoraDaTela: string | null = null
const recarregar = (quem: Pessoa) =>
  chamar(agoraDaTela ? "tela lista (só mudanças)" : "tela lista (recarga)", quem, "GET", agoraDaTela ? `${LISTA}&desde=${encodeURIComponent(agoraDaTela)}` : LISTA)

/**
 * Abrir a tela: além de medir, de tempos em tempos atualiza o estado
 * compartilhado com o que o servidor devolveu — é o que acontece com
 * quem recarrega a página. Com centenas de pessoas, só uma recarga a
 * cada 5 s alimenta o estado, para o gerador de carga não gastar a CPU
 * que é do servidor.
 */
let ultimaAtualizacao = 0
async function abrirTela(quem: Pessoa) {
  const r = await chamar("tela lista", quem, "GET", LISTA)
  if (r.status === 200 && typeof r.corpo.agora === "string") agoraDaTela = r.corpo.agora
  if (r.status === 200 && Date.now() - ultimaAtualizacao > 5000) {
    ultimaAtualizacao = Date.now()
    const lista = (r.corpo.tarefas ?? []) as TarefaApi[]
    const vistas = new Set<string>()
    for (const t of lista) {
      if (!/CLIENTE TESTE|^NOVA |^ESTRESSE /.test(t.titulo)) continue
      vistas.add(t.id)
      estado.tarefas.set(t.id, t)
    }
    // O que não voltou fechou (ou foi apagado): some do estado.
    for (const id of estado.tarefas.keys()) if (!vistas.has(id)) estado.tarefas.delete(id)
    estado.ids = [...estado.tarefas.keys()]
  }
  return r
}

const OPERACOES: Op[] = [
  // ── Telas ──
  { nome: "tela lista", tipo: "tela", peso: 5, fn: abrirTela },
  { nome: "tela lista (só mudanças)", tipo: "tela", peso: 9, fn: (q) => recarregar(q) },
  { nome: "tela agenda", tipo: "tela", peso: 3, fn: (q) => chamar("tela agenda", q, "GET", "/api/tarefas?abertas=1&vinculos=1") },
  { nome: "tela equipe", tipo: "tela", peso: 4, fn: (q) => chamar("tela equipe", q, "GET", "/api/users") },
  { nome: "tela eu", tipo: "tela", peso: 4, fn: (q) => chamar("tela eu", q, "GET", "/api/auth/me") },
  { nome: "tela judicial", tipo: "tela", peso: 2, fn: (q) => chamar("tela judicial", q, "GET", "/api/judicial") },
  { nome: "tela administrativo", tipo: "tela", peso: 2, fn: (q) => chamar("tela administrativo", q, "GET", "/api/administrativo") },
  { nome: "tela processos", tipo: "tela", peso: 2, fn: (q) => chamar("tela processos", q, "GET", "/api/processos") },
  { nome: "tela clientes", tipo: "tela", peso: 2, fn: (q) => chamar("tela clientes", q, "GET", "/api/clientes") },
  { nome: "tela intimações", tipo: "tela", peso: 2, fn: (q) => chamar("tela intimações", q, "GET", "/api/intimacoes") },
  { nome: "tela mapa", tipo: "tela", peso: 1, fn: (q) => chamar("tela mapa", q, "GET", "/api/mapa") },
  { nome: "tela configurações", tipo: "tela", peso: 1, fn: (q) => chamar("tela configurações", q, "GET", "/api/configuracoes") },
  { nome: "tela andamentos", tipo: "tela", peso: 1, fn: (q) => chamar("tela andamentos", q, "GET", `/api/andamentos?processoId=${sortear(estado.processos)}`) },
  { nome: "abrir tarefa", tipo: "tela", peso: 5, fn: (q) => { const t = tarefaAoAcaso(); return t ? chamar("abrir tarefa", q, "GET", `/api/tarefas/${t.id}`) : Promise.resolve() } },
  { nome: "abrir histórico", tipo: "tela", peso: 3, fn: (q) => { const t = tarefaAoAcaso(); return t ? chamar("abrir histórico", q, "GET", `/api/tarefas/${t.id}/historico`) : Promise.resolve() } },
  { nome: "html /times/vermelho", tipo: "tela", peso: 2, fn: (q) => chamar("html /times/vermelho", q, "GET", "/times/vermelho", undefined, { html: true }) },
  { nome: "html /agenda", tipo: "tela", peso: 1, fn: (q) => chamar("html /agenda", q, "GET", "/agenda", undefined, { html: true }) },
  { nome: "html /judicial", tipo: "tela", peso: 1, fn: (q) => chamar("html /judicial", q, "GET", "/judicial", undefined, { html: true }) },
  { nome: "html /", tipo: "tela", peso: 1, fn: (q) => chamar("html /", q, "GET", "/", undefined, { html: true }) },

  // ── Cliques no fluxo ──
  {
    nome: "mover", tipo: "clique", peso: 12,
    fn: async (q) => {
      const t = tarefaAoAcaso(); const g = t && grupoDe(t); if (!t || !g) return
      const resps = acaso() < 0.5 ? undefined : acaso() < 0.5 ? null : amostra(EQUIPE, 1 + Math.floor(acaso() * 3)).map((p) => p.id)
      const r = await acao(q, t.id, { acao: "mover", de: { setor: g.setor, etapa: g.etapa }, para: lugarDe(sortear(TODAS_ETAPAS)), ...(resps === undefined ? {} : { responsaveis: resps }) })
      lembrar(r, t.id); if (r.status !== 200) await recarregar(q)
    },
  },
  {
    nome: "pôr também em", tipo: "clique", peso: 3,
    fn: async (q) => {
      const t = tarefaAoAcaso(); if (!t) return
      const r = await acao(q, t.id, { acao: "adicionar", para: lugarDe(sortear(TODAS_ETAPAS)), responsaveis: amostra(EQUIPE, 1 + Math.floor(acaso() * 2)).map((p) => p.id) })
      lembrar(r, t.id); if (r.status !== 200) await recarregar(q)
    },
  },
  {
    nome: "concluir parte", tipo: "clique", peso: 10,
    fn: async (q) => {
      const t = tarefaAoAcaso(); const g = t && grupoDe(t); if (!t || !g) return
      const parte = sortear(g.abertas)
      const r = await acao(q, t.id, { acao: "concluirParte", em: { setor: g.setor, etapa: g.etapa }, responsavelId: parte.responsavelId })
      lembrar(r, t.id); if (r.status !== 200) await recarregar(q)
    },
  },
  {
    nome: "concluir minha parte", tipo: "clique", peso: 6,
    fn: async (q) => {
      const t = tarefaAoAcaso(); if (!t) return
      const r = await acao(q, t.id, { acao: "concluirMinhaParte" })
      lembrar(r, t.id); if (r.status !== 200) await recarregar(q)
    },
  },
  {
    nome: "concluir etapa", tipo: "clique", peso: 2,
    fn: async (q) => {
      const t = tarefaAoAcaso(); const g = t && grupoDe(t); if (!t || !g) return
      const r = await acao(q, t.id, { acao: "concluirEtapa", em: { setor: g.setor, etapa: g.etapa } })
      lembrar(r, t.id); if (r.status !== 200) await recarregar(q)
    },
  },
  {
    nome: "responsáveis", tipo: "clique", peso: 4,
    fn: async (q) => {
      const t = tarefaAoAcaso(); const g = t && grupoDe(t); if (!t || !g) return
      const r = await acao(q, t.id, { acao: "responsaveis", em: { setor: g.setor, etapa: g.etapa }, responsaveis: amostra(EQUIPE, Math.floor(acaso() * 4)).map((p) => p.id) })
      lembrar(r, t.id); if (r.status !== 200) await recarregar(q)
    },
  },
  {
    nome: "criar tarefa", tipo: "clique", peso: 5,
    fn: async (q) => {
      const r = await chamar("criar tarefa", q, "POST", "/api/tarefas", {
        titulo: `ESTRESSE ${String(estado.criadas++).padStart(5, "0")} — ${sortear(["análise", "vídeo", "protocolo", "exigência", "entrega"])}`,
        data: hoje(),
        etapa: sortear(TODAS_ETAPAS),
        ...(acaso() < 0.5 ? { responsaveis: amostra(EQUIPE, 1 + Math.floor(acaso() * 2)).map((p) => p.id) } : {}),
        ...(acaso() < 0.3 ? { processoId: sortear(estado.processos) } : {}),
      })
      const nova = r.corpo.tarefa as TarefaApi | undefined
      if (nova?.id) { estado.tarefas.set(nova.id, nova); estado.ids.push(nova.id) }
    },
  },
  {
    nome: "editar por fora (PATCH)", tipo: "clique", peso: 5,
    fn: async (q) => {
      const t = tarefaAoAcaso(); if (!t) return
      const y = acaso()
      const campos =
        y < 0.25 ? { status: acaso() < 0.5 ? "CONCLUIDA" : "PENDENTE" }
        : y < 0.5 ? { setor: sortear(TIMES_TAREFA) }
        : y < 0.75 ? { responsavelId: acaso() < 0.2 ? null : sortear(EQUIPE).id }
        : { prioridade: sortear(["BAIXA", "MEDIA", "ALTA", "URGENTE"]) }
      const r = await chamar("editar por fora (PATCH)", q, "PATCH", `/api/tarefas/${t.id}`, campos)
      // A tela troca o cartão pela resposta (usar-tarefas.ts); só sem partes ela recarrega.
      const nova = r.corpo.tarefa as TarefaApi | undefined
      if (r.status === 200 && Array.isArray(nova?.atribuicoes)) lembrar(r, t.id)
      else await recarregar(q)
    },
  },
  {
    nome: "editar tarefa (PUT)", tipo: "clique", peso: 3,
    fn: async (q) => {
      const t = tarefaAoAcaso(); if (!t) return
      await chamar("editar tarefa (PUT)", q, "PUT", `/api/tarefas/${t.id}`, {
        titulo: t.titulo, data: hoje(), descricao: `Editada pelo teste às ${new Date().toISOString()}`, hora: acaso() < 0.3 ? "14:30" : undefined,
        prioridade: sortear(["BAIXA", "MEDIA", "ALTA"]), setor: t.setor ?? undefined, responsavelId: t.responsavelId ?? undefined, pasta: t.pasta ?? undefined,
      })
    },
  },
  {
    nome: "apagar tarefa", tipo: "clique", peso: 1,
    fn: async (q) => {
      const t = tarefaAoAcaso(); if (!t || !/^ESTRESSE|^NOVA/.test(t.titulo)) return
      const r = await chamar("apagar tarefa", q, "DELETE", `/api/tarefas/${t.id}`)
      if (r.status === 200 || r.status === 204) esquecer(t.id)
    },
  },
  {
    nome: "abrir dúvida", tipo: "clique", peso: 3,
    fn: async (q) => {
      const t = tarefaAoAcaso(); if (!t || t.tipo === "DUVIDA") return
      const r = await chamar("abrir dúvida", q, "POST", `/api/tarefas/${t.id}/duvidas`, {
        pergunta: `O cliente já mandou o laudo atualizado? (${t.titulo.slice(0, 30)})`,
        responsavelId: sortear(EQUIPE).id,
      })
      const d = r.corpo.duvida ?? r.corpo.tarefa
      const id = (d as { id?: string } | undefined)?.id
      if (r.status === 201 && id) estado.duvidasAbertas.push(id)
    },
  },
  {
    nome: "responder dúvida", tipo: "clique", peso: 3,
    fn: async (q) => {
      const id = estado.duvidasAbertas.shift(); if (!id) return
      const r = await chamar("responder dúvida", q, "POST", `/api/tarefas/${id}/resposta`, { resposta: "Sim, está na pasta do Drive desde ontem." })
      if (r.status !== 200) await recarregar(q)
    },
  },

  // ── Processos, clientes, andamentos ──
  { nome: "processo: status", tipo: "clique", peso: 2, fn: (q) => chamar("processo: status", q, "PATCH", `/api/processos/${sortear(estado.processos)}/status`, { status: sortear(["EM_ANALISE", "AGUARDANDO_INSS", "PERICIA_MARCADA", "PERICIA_CONCLUIDA", "BENEFICIO_CONCEDIDO", "RECUSADO"]) }) },
  { nome: "processo: perícia", tipo: "clique", peso: 1, fn: (q) => chamar("processo: perícia", q, "PATCH", `/api/processos/${sortear(estado.processos)}/pericia`, { situacaoPericia: sortear(["MARCAR_PERICIA", "PERICIA_MARCADA", "PRORROGACAO", null]) }) },
  { nome: "processo: ver", tipo: "tela", peso: 2, fn: (q) => chamar("processo: ver", q, "GET", `/api/processos/${sortear(estado.processos)}`) },
  { nome: "andamento: novo", tipo: "clique", peso: 2, fn: (q) => chamar("andamento: novo", q, "POST", "/api/andamentos", { processoId: sortear(estado.processos), data: hoje(), descricao: `ESTRESSE andamento ${Date.now()}`, status: "EM_ANALISE" }) },
  { nome: "cliente: ver", tipo: "tela", peso: 2, fn: (q) => chamar("cliente: ver", q, "GET", `/api/clientes/${sortear(estado.clientes)}`) },
  { nome: "cliente: editar", tipo: "clique", peso: 1, fn: (q) => chamar("cliente: editar", q, "PUT", `/api/clientes/${sortear(estado.clientes)}`, { nome: `ESTRESSE CLIENTE ${Math.floor(acaso() * 30)}`, telefone: "(61) 98888-0000" }) },

  // ── Intimações ──
  { nome: "intimação: tratar", tipo: "clique", peso: 2, fn: (q) => chamar("intimação: tratar", q, "PATCH", `/api/intimacoes/${sortear(estado.intimacoes)}`, { tratada: acaso() < 0.7 }) },
  { nome: "intimação: vincular", tipo: "clique", peso: 1, fn: (q) => chamar("intimação: vincular", q, "PATCH", `/api/intimacoes/${sortear(estado.intimacoes)}`, { processoId: sortear(estado.processos) }) },
  { nome: "intimações → tarefas", tipo: "clique", peso: 1, quem: U.zeca, fn: (q) => chamar("intimações → tarefas", q, "POST", "/api/intimacoes/tarefas", {}) },

  // ── Administração ──
  { nome: "admin: trava", tipo: "clique", peso: 1, quem: U.zeca, fn: (q) => chamar("admin: trava", q, "PATCH", "/api/configuracoes", { chave: "aviso_cliente_whatsapp", valor: acaso() < 0.5 }) },
  { nome: "admin: trazer em lote", tipo: "clique", peso: 1, quem: U.zeca, fn: (q) => chamar("admin: trazer em lote", q, "POST", "/api/tarefas/fluxo") },

  // ── O Claude pelo conector ──
  { nome: "mcp fluxo_do_escritorio", tipo: "tela", peso: 1, fn: () => mcp("fluxo_do_escritorio", {}) },
  { nome: "mcp listar_tarefas", tipo: "tela", peso: 3, fn: () => mcp("listar_tarefas", { de_quem: acaso() < 0.5 ? "eu" : "todos", limite: 50 }) },
  { nome: "mcp ver_tarefa", tipo: "tela", peso: 2, fn: () => { const t = tarefaAoAcaso(); return t ? mcp("ver_tarefa", { id: t.id }) : Promise.resolve() } },
  { nome: "mcp avisos_pendentes", tipo: "tela", peso: 1, fn: () => mcp("avisos_pendentes", {}) },
  {
    nome: "mcp mover_tarefa", tipo: "clique", peso: 3,
    fn: async () => {
      const t = tarefaAoAcaso(); const g = t && grupoDe(t); if (!t || !g) return
      const r = await mcp("mover_tarefa", { id: t.id, para: sortear(TODAS_ETAPAS), ...(g.etapa ? { de: g.etapa } : { de: "sem-etapa", time_de: g.setor }) })
      if (r.status === 200 && !r.erroFerramenta) esquecer(t.id)
    },
  },
  { nome: "mcp concluir_minha_parte", tipo: "clique", peso: 3, fn: async () => { const t = tarefaAoAcaso(); if (!t) return; const r = await mcp("concluir_minha_parte", { id: t.id }); if (r.status === 200 && !r.erroFerramenta) esquecer(t.id) } },
  { nome: "mcp criar_tarefa", tipo: "clique", peso: 2, fn: async () => { const r = await mcp("criar_tarefa", { titulo: `ESTRESSE ${String(estado.criadas++).padStart(5, "0")} — via Claude`, etapa: sortear(TODAS_ETAPAS), responsaveis: ["eu"], chave_externa: `estresse:${Date.now()}:${Math.floor(acaso() * 1e6)}` }); void r /* a tarefa nova entra no estado na próxima recarga da tela */ } },
  { nome: "mcp por_tambem_em", tipo: "clique", peso: 1, fn: async () => { const t = tarefaAoAcaso(); if (!t) return; const r = await mcp("por_tambem_em", { id: t.id, etapa: sortear(TODAS_ETAPAS) }); if (r.status === 200 && !r.erroFerramenta) esquecer(t.id) } },
  { nome: "mcp trocar_responsaveis", tipo: "clique", peso: 1, fn: async () => { const t = tarefaAoAcaso(); const g = t && grupoDe(t); if (!t || !g) return; const r = await mcp("trocar_responsaveis", { id: t.id, etapa: g.etapa ?? "sem-etapa", ...(g.etapa ? {} : { time: g.setor }), responsaveis: amostra(["Zeca", "Tayane", "Guilherme", "Ryan", "eu"], 1 + Math.floor(acaso() * 2)) }); if (r.status === 200 && !r.erroFerramenta) esquecer(t.id) } },
  { nome: "mcp abrir_duvida", tipo: "clique", peso: 1, fn: async () => { const t = tarefaAoAcaso(); if (!t || t.tipo === "DUVIDA") return; const r = await mcp("abrir_duvida", { id: t.id, pergunta: "Falta algum documento para protocolar?", para: "Tayane" }); const d = r.dados.duvida as { id?: string } | undefined; if (d?.id) estado.duvidasAbertas.push(d.id) } },
]
const PESO = OPERACOES.reduce((s, o) => s + o.peso, 0)
function sortearOp(): Op {
  let x = acaso() * PESO
  for (const o of OPERACOES) {
    x -= o.peso
    if (x <= 0) return o
  }
  return OPERACOES[0]
}

// ── 1. Anatomia: quanto custa cada clique ─────────────────

type Anatomia = { nome: string; status: number; appMs: number; appBytes: number; idas: number; bancoMs: number; bancoBytes: number; rotas: string }

async function anatomia(): Promise<Anatomia[]> {
  const linhas: Anatomia[] = []
  // Aquecimento: o primeiro pedido de cada rota paga a compilação/cache.
  for (const o of OPERACOES) await o.fn(o.quem ?? U.zeca).catch(() => {})
  for (const o of OPERACOES) {
    zerarMedidas()
    await contagem(true)
    await o.fn(o.quem ?? U.tay).catch(() => {})
    const c = await contagem()
    const op = Object.keys(tempos)[0]
    const ms = op ? tempos[op][0] : 0
    const st = op ? Number(Object.keys(statusPorOp[op])[0]) : 0
    const rotas = Object.entries(c.porRota).sort((a, b) => b[1].n - a[1].n).map(([r, v]) => `${v.n}× ${r.replace(/^(GET|POST|PATCH|DELETE|PUT) \//, "$1 ")}`).join(", ")
    linhas.push({ nome: o.nome, status: st, appMs: ms, appBytes: 0, idas: c.total, bancoMs: c.ms, bancoBytes: c.bytes, rotas })
  }
  // O login, à parte: bcrypt é caro de propósito.
  zerarMedidas(); await contagem(true)
  const l = await chamar("login", null, "POST", "/api/auth/login", { email: U.zeca.email, password: "senha-do-teste" })
  const cl = await contagem()
  linhas.push({ nome: "login (senha certa)", status: l.status, appMs: l.ms, appBytes: l.bytes, idas: cl.total, bancoMs: cl.ms, bancoBytes: cl.bytes, rotas: Object.keys(cl.porRota).join(", ") })
  zerarMedidas(); await contagem(true)
  const le = await chamar("login", null, "POST", "/api/auth/login", { email: U.zeca.email, password: "errada" })
  const cle = await contagem()
  linhas.push({ nome: "login (senha errada)", status: le.status, appMs: le.ms, appBytes: le.bytes, idas: cle.total, bancoMs: cle.ms, bancoBytes: cle.bytes, rotas: Object.keys(cle.porRota).join(", ") })
  zerarMedidas()
  return linhas
}

// ── 2. Tudo ao mesmo tempo, em rampa ──────────────────────

type Nivel = {
  simultaneas: number
  segundos: number
  operacoes: number
  porSegundo: number
  clique: { p50: number; p95: number; p99: number; max: number; n: number }
  tela: { p50: number; p95: number; p99: number; max: number; n: number }
  lista: { p50: number; p95: number; n: number }
  erros: number
  errosPct: number
  conflitos409: number
  rejeitados4xx: number
  conexoesPg: number
  rssNextMb: number
  idasPorOp: number
  teto: boolean
}

function rssDoNext() {
  try {
    const out = execSync("ps -eo rss,args | grep 'next-server' | grep -v grep | awk '{s+=$1} END {print s}'").toString().trim()
    return Math.round(Number(out) / 1024)
  } catch {
    return 0
  }
}

async function nivel(simultaneas: number, segundos: number): Promise<Nivel> {
  zerarMedidas()
  await contagem(true)
  const fim = Date.now() + segundos * 1000
  let operacoes = 0
  let conexoesMax = 0
  const monitor = setInterval(() => {
    db.query(`select count(*) from pg_stat_activity where datname = 'fluxo' and state = 'active'`)
      .then((r) => { conexoesMax = Math.max(conexoesMax, Number(r.rows[0].count)) })
      .catch(() => {})
  }, 2000)

  await Promise.all(
    Array.from({ length: simultaneas }, async (_, i) => {
      const eu = EQUIPE[i % EQUIPE.length]
      // Cada pessoa abre a tela antes de clicar, como na vida real.
      await chamar("tela lista", eu, "GET", LISTA)
      while (Date.now() < fim) {
        const o = sortearOp()
        try {
          await o.fn(o.quem ?? eu)
        } catch {
          // a operação já registrou o status
        }
        operacoes++
      }
    })
  )
  clearInterval(monitor)
  const c = await contagem()

  const ops = Object.keys(tempos)
  const ehTela = (op: string) => /^(tela|abrir|html|processo: ver|cliente: ver|mcp (fluxo|listar|ver|avisos))/.test(op)
  const junta = (filtro: (op: string) => boolean) => ops.filter(filtro).flatMap((op) => tempos[op])
  const resumo = (xs: number[]) => ({ p50: percentil(xs, 50), p95: percentil(xs, 95), p99: percentil(xs, 99), max: xs.length ? Math.max(...xs) : 0, n: xs.length })
  const clique = resumo(junta((op) => !ehTela(op)))
  const tela = resumo(junta(ehTela))
  const listaMs = junta((op) => op === "tela lista" || op === "tela lista (recarga)")
  let erros = 0, conflitos = 0, rejeitados = 0, total = 0
  for (const st of Object.values(statusPorOp)) {
    for (const [codigo, n] of Object.entries(st)) {
      total += n
      const cod = Number(codigo)
      if (cod >= 500 || cod === 0) erros += n
      else if (cod === 409) conflitos += n
      else if (cod >= 400) rejeitados += n
    }
  }
  const errosPct = total ? (100 * erros) / total : 0
  return {
    simultaneas,
    segundos,
    operacoes,
    porSegundo: operacoes / segundos,
    clique,
    tela,
    lista: { p50: percentil(listaMs, 50), p95: percentil(listaMs, 95), n: listaMs.length },
    erros,
    errosPct,
    conflitos409: conflitos,
    rejeitados4xx: rejeitados,
    conexoesPg: conexoesMax,
    rssNextMb: rssDoNext(),
    idasPorOp: total ? c.total / total : 0,
    teto: clique.p95 > 2000 || errosPct > 1,
  }
}

// ── 3. Tempestade de login (bcrypt sem limite de tentativas) ──

async function tempestadeDeLogin() {
  zerarMedidas()
  const ini = performance.now()
  const tentativas = 60
  const [logins, telas] = await Promise.all([
    Promise.all(Array.from({ length: tentativas }, () => chamar("login (errado, tempestade)", null, "POST", "/api/auth/login", { email: U.zeca.email, password: `errada-${acaso()}` }))),
    // Enquanto isso, a equipe tenta usar o sistema.
    (async () => {
      const xs: number[] = []
      for (let i = 0; i < 12; i++) xs.push((await chamar("tela equipe (durante tempestade)", U.tay, "GET", "/api/users")).ms)
      return xs
    })(),
  ])
  const total = (performance.now() - ini) / 1000
  const todos401 = logins.every((l) => l.status === 401)
  const bloqueou = logins.some((l) => l.status === 429)
  return { tentativas, segundos: total, todos401, bloqueou, loginP95: percentil(logins.map((l) => l.ms), 95), telaP95: percentil(telas, 95), telaP50: percentil(telas, 50) }
}

// ── Rodada ────────────────────────────────────────────────

async function main() {
  console.log(`Teste de estresse — ${N_TAREFAS} tarefas, ${SEGUNDOS}s por nível, níveis ${NIVEIS.join(" → ")}`)
  await preparar()

  console.log("\n── 1. Anatomia: idas ao banco por clique ──")
  const anat = await anatomia()
  const ordem = [...anat].sort((a, b) => b.idas - a.idas)
  console.log(`  ${"operação".padEnd(28)} ${"st".padStart(3)} ${"app ms".padStart(7)} ${"idas".padStart(5)} ${"banco ms".padStart(9)} ${"volta KB".padStart(9)}  rotas`)
  for (const a of ordem) {
    console.log(`  ${a.nome.padEnd(28)} ${String(a.status).padStart(3)} ${a.appMs.toFixed(0).padStart(7)} ${String(a.idas).padStart(5)} ${a.bancoMs.toFixed(0).padStart(9)} ${(a.bancoBytes / 1024).toFixed(1).padStart(9)}  ${a.rotas.slice(0, 110)}`)
  }
  const mediaIdas = anat.reduce((s, a) => s + a.idas, 0) / anat.length
  console.log(`  média: ${mediaIdas.toFixed(1)} idas ao banco por operação`)

  console.log("\n── 2. Tudo ao mesmo tempo, em rampa ──")
  const niveis: Nivel[] = []
  let teto: Nivel | null = null
  for (const s of NIVEIS) {
    const n = await nivel(s, SEGUNDOS)
    niveis.push(n)
    console.log(
      `  ${String(s).padStart(4)} pessoas │ ${n.porSegundo.toFixed(0).padStart(4)} ops/s │ clique p50 ${n.clique.p50.toFixed(0).padStart(5)} p95 ${n.clique.p95.toFixed(0).padStart(5)} p99 ${n.clique.p99.toFixed(0).padStart(5)} ms │ tela p50 ${n.tela.p50.toFixed(0).padStart(5)} p95 ${n.tela.p95.toFixed(0).padStart(5)} ms │ lista p95 ${n.lista.p95.toFixed(0).padStart(5)} ms │ erros ${n.erros} (${n.errosPct.toFixed(2)}%) │ 409 ${n.conflitos409} │ 4xx ${n.rejeitados4xx} │ pg ativas ${n.conexoesPg} │ next ${n.rssNextMb} MB${n.teto ? "  ← TETO" : ""}`
    )
    if (erros5xx.length) console.log("    5xx: " + [...new Set(erros5xx.map((e) => e.replace(/\/[0-9a-f-]{36}/g, "/<id>")))].slice(0, 5).join("\n         "))
    if (n.teto && !teto) teto = n
    if (n.teto && n.errosPct > 20) {
      console.log("  parando a rampa: o sistema já está recusando a maior parte dos pedidos")
      break
    }
  }
  const ultimoNivel = niveis[niveis.length - 1]
  console.log("\n  por operação, no último nível:")
  console.log(tabelaDeTempos())

  console.log("\n── 3. Tempestade de login ──")
  const tempestade = await tempestadeDeLogin()
  console.log(`  ${tempestade.tentativas} senhas erradas de uma vez: ${tempestade.segundos.toFixed(1)}s, login p95 ${tempestade.loginP95.toFixed(0)} ms, ${tempestade.todos401 ? "todas 401" : "houve outro status"}, ${tempestade.bloqueou ? "bloqueou (429)" : "NÃO bloqueou — sem limite de tentativas"}; a tela da equipe nesse meio tempo: p50 ${tempestade.telaP50.toFixed(0)} ms, p95 ${tempestade.telaP95.toFixed(0)} ms`)

  console.log("\n── 4. O banco continua certo? ──")
  // A trava precisa terminar desligada.
  await chamar("admin: trava", U.zeca, "PATCH", "/api/configuracoes", { chave: "aviso_cliente_whatsapp", valor: false })
  const inv = await invariantes("estresse")
  const duplicadasOrigem = (await db.query(`select origem_id, count(*) from tarefas where origem_id like 'estresse:%' or origem_id like 'djen:%' group by origem_id having count(*) > 1`)).rows
  confere(duplicadasOrigem.length === 0, `${duplicadasOrigem.length} origens duplicadas (criar_tarefa com chave_externa ou DJEN)`)
  const contadores = (await db.query(`
    select count(*) filter (where status in ('CONCLUIDA','CANCELADA')) as fechadas, count(*) as total,
           count(*) filter (where tipo = 'DUVIDA') as duvidas, count(*) filter (where tipo = 'DUVIDA' and resposta is not null) as respondidas
    from tarefas t where t.origem_id like 'teste-escala:%' or t.origem_id like 'estresse:%' or t.titulo like 'ESTRESSE %' or t.titulo like 'NOVA %' or t.tipo = 'DUVIDA'`)).rows[0]
  console.log(`  ${contadores.total} tarefas de teste (${contadores.fechadas} fechadas), ${contadores.duvidas} dúvidas (${contadores.respondidas} respondidas), ${inv.gruposAbertos} cartões abertos`)

  const quentes = (await db.query(`
    select left(regexp_replace(query, '\\s+', ' ', 'g'), 150) as consulta, calls, round(total_exec_time::numeric) as total_ms, round(mean_exec_time::numeric, 1) as media_ms, rows
    from pg_stat_statements where dbid = (select oid from pg_database where datname = 'fluxo') and query not like '%pg_stat%'
    order by total_exec_time desc limit 12`)).rows
  console.log("\n  consultas mais caras (pg_stat_statements):")
  for (const q of quentes) console.log(`    ${String(q.total_ms).padStart(8)} ms  ${String(q.calls).padStart(7)}×  média ${String(q.media_ms).padStart(7)} ms  ${q.consulta}`)

  console.log(`\nverificações: ${verificacoes}, falhas: ${falhas.length}, erros 5xx no total: ${erros5xx.length}`)
  for (const f of falhas.slice(0, 30)) console.log("  ✗ " + f)
  if (teto) console.log(`TETO: ${teto.simultaneas} pessoas ao mesmo tempo (p95 do clique ${teto.clique.p95.toFixed(0)} ms, erros ${teto.errosPct.toFixed(2)}%)`)
  else console.log(`SEM TETO até ${ultimoNivel.simultaneas} pessoas (p95 do clique ${ultimoNivel.clique.p95.toFixed(0)} ms)`)

  writeFileSync(SAIDA, JSON.stringify({ anatomia: anat, niveis, tempestade, quentes, falhas, verificacoes, teto: teto?.simultaneas ?? null }, null, 2))
  console.log(`resultado em ${SAIDA}`)
  await encerrar()
}

main().catch(async (e) => {
  console.error(e)
  await encerrar(1)
})
