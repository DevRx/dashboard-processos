/**
 * O que os testes de carga do fluxo têm em comum: a equipe de teste, as
 * sessões, o cliente HTTP com medição, o banco semeado, as invariantes
 * e os atalhos para falar com a API.
 *
 * Usado por escala.ts (regressão do fluxo) e estresse.ts (todas as
 * operações ao mesmo tempo, até o teto). NÃO rode contra o banco de
 * produção: o semeador apaga e cria tarefas de teste.
 */
import pg from "pg"
import { SignJWT } from "jose"

import { ETAPAS, gruposDa, atribuicoesDa, type Atribuicao, type EtapaId, type TimeTarefa } from "../../lib/domain/tarefa"

export const BASE = process.env.BASE ?? "http://localhost:3123"
export const SEGREDO = process.env.SESSION_SECRET ?? ""

if (!SEGREDO || !process.env.DATABASE_URL) {
  console.error("Defina SESSION_SECRET e DATABASE_URL.")
  process.exit(2)
}
if (/supabase\.co|pooler\.supabase/.test(process.env.DATABASE_URL)) {
  console.error("Isto apaga e cria tarefas de teste. Não rode contra o Supabase de produção.")
  process.exit(2)
}

// Coluna `date` chega como texto AAAA-MM-DD, não como Date no fuso da máquina.
pg.types.setTypeParser(1082, (v) => v)
export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 })

// ── Equipe do teste ───────────────────────────────────────

export const U = {
  zeca: { id: "11111111-0000-0000-0000-000000000001", name: "José Carlos de Moura", email: "zeca@teste.local", role: "ADMIN" },
  tay: { id: "11111111-0000-0000-0000-000000000002", name: "Tayane Matias", email: "tay@teste.local", role: "ASSISTENTE" },
  gui: { id: "11111111-0000-0000-0000-000000000003", name: "Guilherme Souza", email: "gui@teste.local", role: "ASSISTENTE" },
  claude: { id: "11111111-0000-0000-0000-000000000004", name: "Claude", email: "claude@teste.local", role: "ASSISTENTE" },
  ryan: { id: "11111111-0000-0000-0000-000000000005", name: "Ryan Lima", email: "ryan@teste.local", role: "ASSISTENTE" },
} as const
export type Pessoa = (typeof U)[keyof typeof U]
export const EQUIPE: Pessoa[] = Object.values(U)
const sessoes = new Map<string, string>()

export async function sessao(p: Pessoa) {
  if (!sessoes.has(p.id)) {
    const t = await new SignJWT({ userId: p.id, name: p.name, email: p.email, role: p.role })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("4h")
      .sign(new TextEncoder().encode(SEGREDO))
    sessoes.set(p.id, t)
  }
  return sessoes.get(p.id)!
}

// ── HTTP com medição ──────────────────────────────────────

export type Resposta = { status: number; corpo: Record<string, unknown>; ms: number; bytes: number }
export const tempos: Record<string, number[]> = {}
export const statusPorOp: Record<string, Record<number, number>> = {}
export const erros5xx: string[] = []

export function zerarMedidas() {
  for (const k of Object.keys(tempos)) delete tempos[k]
  for (const k of Object.keys(statusPorOp)) delete statusPorOp[k]
  erros5xx.length = 0
}

/** Uma chamada à API, medida. `html` lê a resposta como texto (telas renderizadas no servidor). */
export async function chamar(
  op: string,
  quem: Pessoa | null,
  metodo: string,
  caminho: string,
  corpo?: unknown,
  opcoes: { html?: boolean; headers?: Record<string, string> } = {}
): Promise<Resposta> {
  const ini = performance.now()
  let status = 0
  let json: Record<string, unknown> = {}
  let bytes = 0
  try {
    const r = await fetch(BASE + caminho, {
      method: metodo,
      headers: {
        "content-type": "application/json",
        ...(quem ? { cookie: `session=${await sessao(quem)}` } : {}),
        ...opcoes.headers,
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      redirect: "manual",
    })
    status = r.status
    if (opcoes.html) {
      const texto = await r.text()
      bytes = texto.length
      json = { html: texto.slice(0, 0), titulo: /<title>([^<]*)<\/title>/.exec(texto)?.[1] ?? "" }
    } else {
      const texto = await r.text()
      bytes = texto.length
      try {
        json = JSON.parse(texto) as Record<string, unknown>
      } catch {
        json = {}
      }
    }
  } catch (e) {
    status = 599
    json = { error: String(e) }
  }
  const ms = performance.now() - ini
  ;(tempos[op] ??= []).push(ms)
  ;(statusPorOp[op] ??= {})[status] = ((statusPorOp[op] ??= {})[status] ?? 0) + 1
  if (status >= 500) erros5xx.push(`${op} ${metodo} ${caminho} → ${status} ${JSON.stringify(json).slice(0, 200)}`)
  return { status, corpo: json, ms, bytes }
}

// ── Utilidades ────────────────────────────────────────────

let semente = 20261013
export function reseed(s: number) {
  semente = s
}
export function acaso() {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff
  return semente / 0x7fffffff
}
export const sortear = <T,>(xs: readonly T[]): T => xs[Math.floor(acaso() * xs.length)]
export const amostra = <T,>(xs: readonly T[], n: number): T[] => [...xs].sort(() => acaso() - 0.5).slice(0, n)

export const falhas: string[] = []
export let verificacoes = 0
export function confere(condicao: unknown, mensagem: string) {
  verificacoes++
  if (!condicao) falhas.push(mensagem)
}

export function percentil(xs: number[], p: number) {
  if (!xs.length) return 0
  const o = [...xs].sort((a, b) => a - b)
  return o[Math.min(o.length - 1, Math.floor((p / 100) * o.length))]
}

export const TODAS_ETAPAS = Object.keys(ETAPAS) as EtapaId[]
export const lugarDe = (e: EtapaId) => ({ setor: ETAPAS[e].time, etapa: e })

export type TarefaApi = {
  id: string
  titulo: string
  setor: string | null
  pasta: string | null
  status: string
  responsavelId: string | null
  createdAt?: string
  deIntimacao?: boolean
  tipo?: string
  atribuicoes?: Atribuicao[]
}

export const hoje = () => new Date().toISOString().slice(0, 10)

// ── Banco limpo e semeado ─────────────────────────────────

export const PASTAS: [TimeTarefa | "PRETO" | null, string | null, number][] = [
  ["AZUL", "TAREFAS ZECA › ANÁLISES", 6],
  ["AZUL", "TAREFAS URGENTES", 4],
  ["AZUL", "TAREFAS DE ACOMPANHAMENTO", 5],
  ["AZUL", "AGENDAR VÍDEO", 3],
  ["VERMELHO", "VIDEOS E VISITAS › VÍDEO CLIENTES", 6],
  ["VERMELHO", "VIDEOS E VISITAS › AGUARDANDO ASSINATURA", 4],
  ["VERMELHO", "JUDICIAL › ANDAMENTO", 18],
  ["VERMELHO", "JUDICIAL › PROTOCOLO NOVO", 8],
  ["VERMELHO", "JUDICIAL › PROTOCOLOS PENDENTES", 4],
  ["VERMELHO", "JUDICIAL › TRIAGEM CLAUDE CONCLUIDA", 3],
  ["VERMELHO", null, 5],
  ["AMARELO", "ADM › PROTOCOLO NOVO", 8],
  ["AMARELO", "ADM › PENDENTE", 5],
  ["AMARELO", "ADM › EXIGÊNCIAS", 6],
  ["AMARELO", "ACOMPANHAMENTO", 5],
  ["AMARELO", "TAREFAS ZECA", 2],
  ["ROSA", "COBRANÇA", 3],
  ["ROSA", "AGENDAR ENTREGA", 3],
  ["ROSA", "ENTREGA MARCADA", 2],
  ["PRETO", "RYAN › IMPLANTAÇÃO", 2],
  [null, null, 3],
]
const PESO_TOTAL = PASTAS.reduce((s, p) => s + p[2], 0)
export function sortearPasta() {
  let x = acaso() * PESO_TOTAL
  for (const p of PASTAS) {
    x -= p[2]
    if (x <= 0) return p
  }
  return PASTAS[0]
}

/** Apaga o que os testes criaram e semeia `n` tarefas nas pastas do escritório. */
export async function semear(n: number) {
  await db.query(
    `insert into users (id, name, email, password, role)
     select * from unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::"UserRole"[])
     on conflict (id) do update set name = excluded.name, email = excluded.email, role = excluded.role`,
    [EQUIPE.map((p) => p.id), EQUIPE.map((p) => p.name), EQUIPE.map((p) => p.email), EQUIPE.map(() => "x"), EQUIPE.map((p) => p.role)]
  )
  await db.query(
    `delete from tarefas where origem_id like 'teste-escala:%' or origem_id like 'djen:%' or origem_id like 'estresse:%'
       or titulo like 'NOVA %' or titulo like '%CLIENTE TESTE%' or titulo like 'Avisar cliente da %' or titulo like 'ESTRESSE %'`
  )
  await db.query(`delete from comunicacoes_djen where djen_id >= 900000000`)
  await db.query(`delete from andamentos where descricao like 'ESTRESSE %'`)
  await db.query(`delete from processos where numero = '10099990020264013400' or observacoes like 'ESTRESSE %'`)
  await db.query(`delete from clientes where cpf = '000.000.000-00' or nome like 'CLIENTE TESTE%' or nome like 'ESTRESSE %'`)

  const ids: string[] = [], titulos: string[] = [], setores: (string | null)[] = [], pastas: (string | null)[] = []
  const status: string[] = [], resp: (string | null)[] = [], datas: string[] = [], origens: string[] = []
  for (let i = 0; i < n; i++) {
    const [setor, pasta] = sortearPasta()
    ids.push(crypto.randomUUID())
    titulos.push(`${pasta?.includes("ANÁLISES") && acaso() < 0.5 ? "PARECER DA ANÁLISE — " : ""}CLIENTE TESTE ${String(i).padStart(5, "0")}`)
    setores.push(setor)
    pastas.push(pasta)
    status.push(acaso() < 0.1 ? "CONCLUIDA" : "PENDENTE")
    resp.push(acaso() < 0.15 ? null : sortear(EQUIPE).id)
    const d = new Date(Date.now() + Math.floor((acaso() - 0.4) * 40) * 86400000)
    datas.push(d.toISOString().slice(0, 10))
    origens.push(`teste-escala:${i}`)
  }
  await db.query(
    `insert into tarefas (id, user_id, titulo, data, status, setor, pasta, responsavel_id, origem_id)
     select id, $9::uuid, titulo, data, status::"TarefaStatus", setor::"SetorTarefa", pasta, resp, origem
     from unnest($1::uuid[], $2::text[], $3::date[], $4::text[], $5::text[], $6::text[], $7::uuid[], $8::text[])
       as x(id, titulo, data, status, setor, pasta, resp, origem)`,
    [ids, titulos, datas, status, setores, pastas, resp, origens, U.zeca.id]
  )
  // Prazos do DJEN sem pasta: entram em Andamentos do vermelho.
  const semPasta = ids.filter((_, i) => setores[i] === "VERMELHO" && pastas[i] === null)
  await db.query(
    `insert into comunicacoes_djen (user_id, djen_id, data_disponibilizacao, texto, tarefa_id)
     select $1::uuid, 900000000 + n, current_date, 'intimação de teste', t
     from unnest($2::uuid[]) with ordinality as x(t, n)`,
    [U.zeca.id, semPasta]
  )
  return ids
}

const FILTRO_TESTE = (t: TarefaApi) =>
  t.titulo.startsWith("CLIENTE TESTE") || t.titulo.includes("CLIENTE TESTE") || t.titulo.startsWith("NOVA ") || t.titulo.startsWith("ESTRESSE ")

export async function listaDaTela(quem: Pessoa = U.zeca, op = "GET lista") {
  const r = await chamar(op, quem, "GET", "/api/tarefas?abertas=1&vinculos=1&atribuicoes=1")
  confere(r.status === 200, `GET da lista devolveu ${r.status}`)
  return ((r.corpo.tarefas ?? []) as TarefaApi[]).filter(FILTRO_TESTE)
}

// ── Invariantes no banco ──────────────────────────────────

const DO_TESTE = `(t.origem_id like 'teste-escala:%' or t.origem_id like 'estresse:%' or t.titulo like 'NOVA %' or t.titulo like 'ESTRESSE %')`

export async function invariantes(rotulo: string) {
  const q = async (sql: string) => (await db.query(sql)).rows

  const statusErrado = await q(`
    select t.id, t.status, count(a.*) filter (where a.fim_em is null) as abertas
    from tarefas t join tarefa_atribuicoes a on a.tarefa_id = t.id
    where ${DO_TESTE}
    group by t.id, t.status
    having (t.status in ('CONCLUIDA','CANCELADA')) = (count(a.*) filter (where a.fim_em is null) > 0)`)
  confere(statusErrado.length === 0, `[${rotulo}] ${statusErrado.length} tarefas com status em desacordo com as partes (ex.: ${JSON.stringify(statusErrado[0])})`)

  const setorErrado = await q(`
    select t.id, t.setor, p.setor as principal
    from tarefas t
    join lateral (
      select setor from tarefa_atribuicoes a where a.tarefa_id = t.id and a.fim_em is null
      order by criada_em, id limit 1) p on true
    where t.setor is distinct from p.setor`)
  confere(setorErrado.length === 0, `[${rotulo}] ${setorErrado.length} tarefas com time diferente da parte principal (ex.: ${JSON.stringify(setorErrado[0])})`)

  const respErrado = await q(`
    select t.id, t.responsavel_id, r.responsavel_id as esperado
    from tarefas t
    join lateral (select setor from tarefa_atribuicoes a where a.tarefa_id = t.id and a.fim_em is null order by criada_em, id limit 1) p on true
    left join lateral (
      select responsavel_id from tarefa_atribuicoes a
      where a.tarefa_id = t.id and a.fim_em is null and a.responsavel_id is not null
      order by (a.setor = p.setor) desc, criada_em, id limit 1) r on true
    where t.responsavel_id is distinct from r.responsavel_id`)
  confere(respErrado.length === 0, `[${rotulo}] ${respErrado.length} tarefas com responsável fora do resumo (ex.: ${JSON.stringify(respErrado[0])})`)

  const duplicadas = await q(`
    select tarefa_id, setor, etapa, responsavel_id, count(*) from tarefa_atribuicoes
    where fim_em is null group by 1,2,3,4 having count(*) > 1`)
  confere(duplicadas.length === 0, `[${rotulo}] ${duplicadas.length} partes abertas duplicadas`)

  const etapas = await q(`select distinct setor, etapa from tarefa_atribuicoes where etapa is not null`)
  for (const e of etapas) {
    confere(ETAPAS[e.etapa as EtapaId]?.time === e.setor, `[${rotulo}] etapa ${e.etapa} gravada no time ${e.setor}`)
  }

  const vagaComNome = await q(`
    select a.tarefa_id from tarefa_atribuicoes a
    where a.fim_em is null and a.responsavel_id is null
      and exists (select 1 from tarefa_atribuicoes b where b.tarefa_id = a.tarefa_id and b.fim_em is null
                  and b.setor = a.setor and b.etapa is not distinct from a.etapa and b.responsavel_id is not null)`)
  confere(vagaComNome.length === 0, `[${rotulo}] ${vagaComNome.length} etapas com vaga "sem responsável" ao lado de responsável com nome`)

  // Partes abertas de tarefa que não existe mais (apagada): o banco deve ter levado junto.
  const orfas = await q(`select count(*) from tarefa_atribuicoes a where not exists (select 1 from tarefas t where t.id = a.tarefa_id)`)
  confere(Number(orfas[0].count) === 0, `[${rotulo}] ${orfas[0].count} partes órfãs de tarefas apagadas`)

  // Dúvida respondida nunca fica aberta; dúvida aberta nunca tem resposta.
  const duvidasErradas = await q(`
    select count(*) from tarefas t where t.tipo = 'DUVIDA' and ${DO_TESTE}
      and ((t.resposta is not null and t.status not in ('CONCLUIDA','CANCELADA')) or (t.resposta is null and t.respondida_em is not null))`)
  confere(Number(duvidasErradas[0].count) === 0, `[${rotulo}] ${duvidasErradas[0].count} dúvidas em estado contraditório`)

  // Nada some da tela: cada grupo aberto no banco aparece na lista da API.
  const tela = await listaDaTela()
  const naTela = new Set<string>()
  for (const t of tela) for (const g of gruposDa(atribuicoesDa({ ...t, atribuicoes: t.atribuicoes ?? [] }))) naTela.add(g.chave)
  const abertosBanco = await q(`
    select distinct a.tarefa_id, a.setor, coalesce(a.etapa,'') as etapa from tarefa_atribuicoes a
    join tarefas t on t.id = a.tarefa_id
    where a.fim_em is null and ${DO_TESTE}`)
  const sumidos = abertosBanco.filter((g: { tarefa_id: string; setor: string; etapa: string }) => !naTela.has(`${g.tarefa_id}|${g.setor}|${g.etapa}`))
  confere(sumidos.length === 0, `[${rotulo}] ${sumidos.length} cartões abertos no banco não aparecem na tela (ex.: ${JSON.stringify(sumidos[0])})`)
  return { gruposAbertos: abertosBanco.length }
}

// ── Atalhos para a API ────────────────────────────────────

export async function novaTarefa(titulo: string, etapa: EtapaId, responsaveis?: string[], quem: Pessoa = U.zeca, op = "POST criar") {
  const r = await chamar(op, quem, "POST", "/api/tarefas", {
    titulo,
    data: hoje(),
    etapa,
    ...(responsaveis ? { responsaveis } : {}),
  })
  confere(r.status === 201, `criar "${titulo}" devolveu ${r.status} ${JSON.stringify(r.corpo).slice(0, 160)}`)
  return (r.corpo.tarefa ?? {}) as TarefaApi
}

export const acao = (quem: Pessoa, id: string, corpo: Record<string, unknown>, op = `fluxo ${corpo.acao}`) =>
  chamar(op, quem, "POST", `/api/tarefas/${id}/fluxo`, corpo)

export async function partesAbertas(id: string) {
  return (await db.query(`select setor, etapa, responsavel_id from tarefa_atribuicoes where tarefa_id = $1 and fim_em is null order by criada_em, id`, [id])).rows
}
export async function statusDa(id: string) {
  return (await db.query(`select status, setor, responsavel_id from tarefas where id = $1`, [id])).rows[0]
}

// ── Relatório ─────────────────────────────────────────────

export function tabelaDeTempos(filtro?: (op: string) => boolean) {
  const linhas: string[] = []
  for (const [op, st] of Object.entries(statusPorOp)) {
    if (filtro && !filtro(op)) continue
    const ms = tempos[op] ?? []
    linhas.push(
      `  ${op.padEnd(30)} n=${String(ms.length).padStart(5)} ${JSON.stringify(st).padEnd(36)} p50 ${percentil(ms, 50).toFixed(0).padStart(5)}ms  p95 ${percentil(ms, 95).toFixed(0).padStart(5)}ms  p99 ${percentil(ms, 99).toFixed(0).padStart(5)}ms  máx ${Math.max(...ms).toFixed(0).padStart(6)}ms`
    )
  }
  return linhas.join("\n")
}

export async function encerrar(codigo?: number) {
  await db.end()
  process.exit(codigo ?? (falhas.length || erros5xx.length ? 1 : 0))
}
