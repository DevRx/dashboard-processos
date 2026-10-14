/**
 * Teste em escala do fluxo novo das tarefas.
 *
 * Roda contra o sistema de verdade — as rotas do Next falando com um
 * Postgres que tem as migrations do repositório (inclusive a
 * 20261013200000_fluxo_atribuicoes) por trás de um PostgREST — e
 * confere, no banco, as regras que o Zeca pediu:
 *
 *   • a tarefa pode estar em mais de um lugar e pode voltar no fluxo;
 *   • com mais de um responsável, quem conclui a sua parte não tira a
 *     tarefa dos outros — ela só sai da etapa com a última parte, e só
 *     fecha de vez quando não sobra parte aberta em lugar nenhum;
 *   • o resumo da tarefa (time, responsável, status) nunca discorda das
 *     partes;
 *   • nenhuma tarefa com parte aberta some da tela dos times.
 *
 * Uso (com o app rodando e o banco no ar):
 *
 *   BASE=http://localhost:3123 DATABASE_URL=postgres://… SESSION_SECRET=… \
 *     npx tsx scripts/teste-fluxo/escala.ts [tarefas] [operacoes] [simultaneas]
 *
 * As tarefas do teste levam origem_id "teste-escala:…" e são apagadas
 * no começo de cada rodada. NÃO rode contra o banco de produção.
 */
import pg from "pg"
import { SignJWT } from "jose"

import {
  ETAPAS,
  TIMES_TAREFA,
  gruposDa,
  atribuicoesDa,
  type Atribuicao,
  type EtapaId,
  type TimeTarefa,
} from "../../lib/domain/tarefa"

const BASE = process.env.BASE ?? "http://localhost:3123"
const SEGREDO = process.env.SESSION_SECRET ?? ""
const N_TAREFAS = Number(process.argv[2] ?? 3000)
const N_OPERACOES = Number(process.argv[3] ?? 10000)
const SIMULTANEAS = Number(process.argv[4] ?? 24)

if (!SEGREDO || !process.env.DATABASE_URL) {
  console.error("Defina SESSION_SECRET e DATABASE_URL.")
  process.exit(2)
}
if (/supabase\.co|pooler\.supabase/.test(process.env.DATABASE_URL)) {
  console.error("Isto apaga e cria tarefas de teste. Não rode contra o Supabase de produção.")
  process.exit(2)
}

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 })

// ── Equipe do teste ───────────────────────────────────────

const U = {
  zeca: { id: "11111111-0000-0000-0000-000000000001", name: "José Carlos de Moura", email: "zeca@teste.local", role: "ADMIN" },
  tay: { id: "11111111-0000-0000-0000-000000000002", name: "Tayane Matias", email: "tay@teste.local", role: "ASSISTENTE" },
  gui: { id: "11111111-0000-0000-0000-000000000003", name: "Guilherme Souza", email: "gui@teste.local", role: "ASSISTENTE" },
  claude: { id: "11111111-0000-0000-0000-000000000004", name: "Claude", email: "claude@teste.local", role: "ASSISTENTE" },
  ryan: { id: "11111111-0000-0000-0000-000000000005", name: "Ryan Lima", email: "ryan@teste.local", role: "ASSISTENTE" },
} as const
type Pessoa = (typeof U)[keyof typeof U]
const EQUIPE: Pessoa[] = Object.values(U)
const sessoes = new Map<string, string>()

async function sessao(p: Pessoa) {
  if (!sessoes.has(p.id)) {
    const t = await new SignJWT({ userId: p.id, name: p.name, email: p.email, role: p.role })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("2h")
      .sign(new TextEncoder().encode(SEGREDO))
    sessoes.set(p.id, t)
  }
  return sessoes.get(p.id)!
}

// ── HTTP ──────────────────────────────────────────────────

type Resposta = { status: number; corpo: Record<string, unknown>; ms: number }
const tempos: Record<string, number[]> = {}
const statusPorOp: Record<string, Record<number, number>> = {}
const erros5xx: string[] = []

async function chamar(op: string, quem: Pessoa, metodo: string, caminho: string, corpo?: unknown): Promise<Resposta> {
  const ini = performance.now()
  let status = 0
  let json: Record<string, unknown> = {}
  try {
    const r = await fetch(BASE + caminho, {
      method: metodo,
      headers: { "content-type": "application/json", cookie: `session=${await sessao(quem)}` },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    status = r.status
    json = (await r.json().catch(() => ({}))) as Record<string, unknown>
  } catch (e) {
    status = 599
    json = { error: String(e) }
  }
  const ms = performance.now() - ini
  ;(tempos[op] ??= []).push(ms)
  ;(statusPorOp[op] ??= {})[status] = ((statusPorOp[op] ??= {})[status] ?? 0) + 1
  if (status >= 500) erros5xx.push(`${op} ${metodo} ${caminho} → ${status} ${JSON.stringify(json).slice(0, 200)}`)
  return { status, corpo: json, ms }
}

// ── Utilidades ────────────────────────────────────────────

let semente = 20261013
function acaso() {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff
  return semente / 0x7fffffff
}
const sortear = <T,>(xs: readonly T[]): T => xs[Math.floor(acaso() * xs.length)]
const amostra = <T,>(xs: readonly T[], n: number): T[] => [...xs].sort(() => acaso() - 0.5).slice(0, n)

const falhas: string[] = []
let verificacoes = 0
function confere(condicao: unknown, mensagem: string) {
  verificacoes++
  if (!condicao) falhas.push(mensagem)
}

function percentil(xs: number[], p: number) {
  if (!xs.length) return 0
  const o = [...xs].sort((a, b) => a - b)
  return o[Math.min(o.length - 1, Math.floor((p / 100) * o.length))]
}

const TODAS_ETAPAS = Object.keys(ETAPAS) as EtapaId[]
const lugarDe = (e: EtapaId) => ({ setor: ETAPAS[e].time, etapa: e })

type TarefaApi = {
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

// ── 1. Banco limpo e semeado ──────────────────────────────

const PASTAS: [TimeTarefa | "PRETO" | null, string | null, number][] = [
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
function sortearPasta() {
  let x = acaso() * PESO_TOTAL
  for (const p of PASTAS) {
    x -= p[2]
    if (x <= 0) return p
  }
  return PASTAS[0]
}

async function semear() {
  await db.query(`
    insert into users (id, name, email, password, role)
    select * from unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::"UserRole"[])
    on conflict (id) do update set name = excluded.name, email = excluded.email, role = excluded.role`,
    [EQUIPE.map((p) => p.id), EQUIPE.map((p) => p.name), EQUIPE.map((p) => p.email), EQUIPE.map(() => "x"), EQUIPE.map((p) => p.role)]
  )
  await db.query(`delete from tarefas where origem_id like 'teste-escala:%' or titulo like 'NOVA %'`)
  await db.query(`delete from comunicacoes_djen where djen_id >= 900000000`)

  const ids: string[] = [], titulos: string[] = [], setores: (string | null)[] = [], pastas: (string | null)[] = []
  const status: string[] = [], resp: (string | null)[] = [], datas: string[] = [], origens: string[] = []
  for (let i = 0; i < N_TAREFAS; i++) {
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

async function listaDaTela(quem: Pessoa = U.zeca) {
  const r = await chamar("GET lista", quem, "GET", "/api/tarefas?abertas=1&vinculos=1&atribuicoes=1")
  confere(r.status === 200, `GET da lista devolveu ${r.status}`)
  return ((r.corpo.tarefas ?? []) as TarefaApi[]).filter((t) => t.titulo.startsWith("CLIENTE TESTE") || t.titulo.includes("CLIENTE TESTE") || t.titulo.startsWith("NOVA "))
}

// ── Invariantes no banco ──────────────────────────────────

async function invariantes(rotulo: string) {
  const q = async (sql: string) => (await db.query(sql)).rows

  const statusErrado = await q(`
    select t.id, t.status, count(a.*) filter (where a.fim_em is null) as abertas
    from tarefas t join tarefa_atribuicoes a on a.tarefa_id = t.id
    where t.origem_id like 'teste-escala:%' or t.titulo like 'NOVA %'
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

  // Nada some da tela: cada grupo aberto no banco aparece na lista da API.
  const tela = await listaDaTela()
  const naTela = new Set<string>()
  for (const t of tela) for (const g of gruposDa(atribuicoesDa({ ...t, atribuicoes: t.atribuicoes ?? [] }))) naTela.add(g.chave)
  const abertosBanco = await q(`
    select distinct a.tarefa_id, a.setor, coalesce(a.etapa,'') as etapa from tarefa_atribuicoes a
    join tarefas t on t.id = a.tarefa_id
    where a.fim_em is null and (t.origem_id like 'teste-escala:%' or t.titulo like 'NOVA %')`)
  const sumidos = abertosBanco.filter((g: { tarefa_id: string; setor: string; etapa: string }) => !naTela.has(`${g.tarefa_id}|${g.setor}|${g.etapa}`))
  confere(sumidos.length === 0, `[${rotulo}] ${sumidos.length} cartões abertos no banco não aparecem na tela (ex.: ${JSON.stringify(sumidos[0])})`)
  return { gruposAbertos: abertosBanco.length }
}

// ── Cenários do Zeca, um por um ───────────────────────────

async function novaTarefa(titulo: string, etapa: EtapaId, responsaveis?: string[]) {
  const r = await chamar("POST criar", U.zeca, "POST", "/api/tarefas", {
    titulo,
    data: new Date().toISOString().slice(0, 10),
    etapa,
    ...(responsaveis ? { responsaveis } : {}),
  })
  confere(r.status === 201, `criar "${titulo}" devolveu ${r.status} ${JSON.stringify(r.corpo).slice(0, 160)}`)
  return (r.corpo.tarefa ?? {}) as TarefaApi
}

const acao = (quem: Pessoa, id: string, corpo: Record<string, unknown>, op = `fluxo ${corpo.acao}`) =>
  chamar(op, quem, "POST", `/api/tarefas/${id}/fluxo`, corpo)

async function partesAbertas(id: string) {
  return (await db.query(`select setor, etapa, responsavel_id from tarefa_atribuicoes where tarefa_id = $1 and fim_em is null order by criada_em, id`, [id])).rows
}
async function statusDa(id: string) {
  return (await db.query(`select status, setor, responsavel_id from tarefas where id = $1`, [id])).rows[0]
}

async function cenarios() {
  // S1 — dois responsáveis: a Tay conclui, a tarefa continua para o Claude.
  const s1 = await novaTarefa("NOVA S1 dois responsáveis", "agendar-video")
  let p = await partesAbertas(s1.id)
  confere(p.length === 2 && p.some((x) => x.responsavel_id === U.tay.id) && p.some((x) => x.responsavel_id === U.claude.id),
    `S1: agendar vídeo deveria nascer com Claude e Tayane (veio ${JSON.stringify(p)})`)
  let r = await acao(U.tay, s1.id, { acao: "concluirMinhaParte" })
  confere(r.status === 200, `S1: Tay concluir a parte dela devolveu ${r.status}`)
  p = await partesAbertas(s1.id)
  confere(p.length === 1 && p[0].responsavel_id === U.claude.id, `S1: depois da Tay, só o Claude deveria seguir com a tarefa (${JSON.stringify(p)})`)
  confere((await statusDa(s1.id)).status === "PENDENTE", "S1: a tarefa não pode fechar quando só a Tay concluiu")
  const tela = await listaDaTela(U.claude)
  confere(tela.some((t) => t.id === s1.id), "S1: a tarefa sumiu da tela depois que a Tay concluiu")
  r = await acao(U.claude, s1.id, { acao: "concluirParte", em: lugarDe("agendar-video"), responsavelId: U.claude.id })
  confere(r.status === 200 && (await statusDa(s1.id)).status === "CONCLUIDA", "S1: com a última parte concluída, a tarefa deveria fechar")

  // S2 — no ADM e no Judicial ao mesmo tempo: concluir um lado não fecha o outro.
  const s2 = await novaTarefa("NOVA S2 ADM e Judicial", "adm-protocolo", [U.gui.id])
  r = await acao(U.zeca, s2.id, { acao: "adicionar", para: lugarDe("jud-pendente"), responsaveis: [U.zeca.id] })
  confere(r.status === 200, `S2: pôr também no Judicial devolveu ${r.status}`)
  r = await acao(U.gui, s2.id, { acao: "concluirMinhaParte" })
  p = await partesAbertas(s2.id)
  confere(p.length === 1 && p[0].etapa === "jud-pendente", `S2: só o Judicial deveria seguir aberto (${JSON.stringify(p)})`)
  confere((await statusDa(s2.id)).setor === "AMARELO" && (await statusDa(s2.id)).status === "PENDENTE", "S2: a tarefa deveria seguir aberta no amarelo")

  // S3 — volta do amarelo para o Acompanhamento do azul (laudo atualizado).
  r = await acao(U.zeca, s2.id, { acao: "mover", de: lugarDe("jud-pendente"), para: lugarDe("acompanhamento") })
  p = await partesAbertas(s2.id)
  confere(r.status === 200 && p.every((x) => x.setor === "AZUL" && x.etapa === "acompanhamento"), `S3: deveria voltar ao Acompanhamento (${JSON.stringify(p)})`)
  confere(p.length === 2 && p.some((x) => x.responsavel_id === U.tay.id) && p.some((x) => x.responsavel_id === U.claude.id),
    `S3: o Acompanhamento indica Claude e Tayane (${JSON.stringify(p)})`)
  const hist = (await db.query(`select fim_motivo from tarefa_atribuicoes where tarefa_id = $1 and fim_em is not null`, [s2.id])).rows.map((x) => x.fim_motivo)
  confere(hist.includes("MOVIDA") && hist.includes("CONCLUIDA"), `S3: o caminho da tarefa deveria ficar registrado (${hist})`)

  // S4 — dez pessoas movendo o mesmo cartão ao mesmo tempo: só uma leva.
  const s4 = await novaTarefa("NOVA S4 corrida", "analise", [U.claude.id])
  const corrida = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      acao(sortear(EQUIPE), s4.id, { acao: "mover", de: lugarDe("analise"), para: lugarDe(i % 2 ? "agendar-video" : "revisao-analise") }, "corrida mover")
    )
  )
  const ok = corrida.filter((x) => x.status === 200).length
  const conflito = corrida.filter((x) => x.status === 409).length
  p = await partesAbertas(s4.id)
  confere(ok === 1 && conflito === 9, `S4: exatamente um mover deveria valer (${ok} valeram, ${conflito} conflitos)`)
  confere(new Set(p.map((x: { setor: string; etapa: string }) => `${x.setor}|${x.etapa}`)).size === 1, `S4: o cartão deveria estar num lugar só (${JSON.stringify(p)})`)

  // S5 — os dois responsáveis concluindo no mesmo instante.
  for (let i = 0; i < 30; i++) {
    const s5 = await novaTarefa(`NOVA S5 simultâneo ${i}`, "aguardando-assinatura")
    await Promise.all([
      acao(U.tay, s5.id, { acao: "concluirMinhaParte" }, "simultâneo concluir"),
      acao(U.claude, s5.id, { acao: "concluirMinhaParte" }, "simultâneo concluir"),
    ])
    const st = await statusDa(s5.id)
    const feitas = (await db.query(`select responsavel_id, fim_por from tarefa_atribuicoes where tarefa_id = $1 and fim_motivo = 'CONCLUIDA'`, [s5.id])).rows
    confere(st.status === "CONCLUIDA" && feitas.length === 2 && feitas.every((f) => f.responsavel_id === f.fim_por),
      `S5[${i}]: com as duas partes concluídas juntas a tarefa deveria fechar e cada um fechar só a sua (${st.status}, ${JSON.stringify(feitas)})`)
  }

  // S6 — concluir pela agenda/quadro geral (status direto) fecha tudo; reabrir volta ao último lugar.
  const s6 = await novaTarefa("NOVA S6 fecha por fora", "videos")
  await chamar("PATCH status", U.zeca, "PATCH", `/api/tarefas/${s6.id}`, { status: "CONCLUIDA" })
  confere((await partesAbertas(s6.id)).length === 0, "S6: fechar a tarefa por fora deveria fechar as partes")
  await chamar("PATCH status", U.zeca, "PATCH", `/api/tarefas/${s6.id}`, { status: "PENDENTE" })
  p = await partesAbertas(s6.id)
  confere(p.length === 1 && p[0].etapa === "videos", `S6: reabrir deveria voltar a Vídeos (${JSON.stringify(p)})`)

  // S7 — arrastar no quadro geral para outro time leva as partes juntas.
  await chamar("PATCH setor", U.zeca, "PATCH", `/api/tarefas/${s6.id}`, { setor: "ROSA" })
  p = await partesAbertas(s6.id)
  confere(p.length === 1 && p[0].setor === "ROSA" && p[0].etapa === null, `S7: trocar o time por fora deveria levar a parte (${JSON.stringify(p)})`)

  // S8 — tarefa do TickTick entra no fluxo na primeira ação, mesmo com cliques simultâneos.
  const legado = (await db.query(`select id from tarefas t where origem_id like 'teste-escala:%' and status = 'PENDENTE' and setor = 'VERMELHO' and pasta = 'JUDICIAL › PROTOCOLO NOVO' and not exists (select 1 from tarefa_atribuicoes a where a.tarefa_id = t.id) limit 20`)).rows
  for (const { id } of legado) {
    await Promise.all([
      acao(U.zeca, id, { acao: "adicionar", para: lugarDe("adm-pendente"), responsaveis: [U.gui.id] }, "legado simultâneo"),
      acao(U.gui, id, { acao: "adicionar", para: lugarDe("adm-pendente"), responsaveis: [U.gui.id] }, "legado simultâneo"),
      acao(U.tay, id, { acao: "responsaveis", em: lugarDe("jud-protocolo"), responsaveis: [U.zeca.id, U.tay.id] }, "legado simultâneo"),
    ])
    p = await partesAbertas(id)
    const lugares = new Set(p.map((x) => `${x.setor}|${x.etapa}`))
    confere(lugares.has("AMARELO|jud-protocolo") && lugares.has("AMARELO|adm-pendente") && lugares.size === 2,
      `S8: a tarefa do TickTick deveria entrar em Judicial › Protocolo (pela pasta) e também em ADM › Pendente (${JSON.stringify(p)})`)
    confere(p.filter((x) => x.etapa === "adm-pendente").length === 1, `S8: ADM › Pendente duplicado (${JSON.stringify(p)})`)
  }

  // S9 — trocar responsáveis não fecha a etapa nem duplica ninguém.
  const s9 = await novaTarefa("NOVA S9 troca de responsáveis", "jud-protocolo")
  await acao(U.zeca, s9.id, { acao: "responsaveis", em: lugarDe("jud-protocolo"), responsaveis: [U.gui.id, U.ryan.id] })
  p = await partesAbertas(s9.id)
  confere(p.length === 2 && p.every((x) => [U.gui.id, U.ryan.id].includes(x.responsavel_id)), `S9: responsáveis trocados (${JSON.stringify(p)})`)
  await acao(U.zeca, s9.id, { acao: "responsaveis", em: lugarDe("jud-protocolo"), responsaveis: [] })
  p = await partesAbertas(s9.id)
  confere(p.length === 1 && p[0].responsavel_id === null && (await statusDa(s9.id)).status === "PENDENTE",
    `S9: sem responsáveis a etapa deveria ficar com uma vaga, ainda aberta (${JSON.stringify(p)})`)

  // S10 — quem não é responsável não fecha a tarefa de vários por engano.
  const s10 = await novaTarefa("NOVA S10 terceiro", "aguardando-assinatura")
  r = await acao(U.gui, s10.id, { acao: "concluirMinhaParte" })
  confere(r.status === 409 && (await partesAbertas(s10.id)).length === 2, `S10: o Guilherme não é responsável — devia receber 409 e nada fechar (${r.status})`)
}

// ── Carga aleatória ───────────────────────────────────────

async function carga() {
  const estado = new Map<string, TarefaApi>()
  for (const t of await listaDaTela()) estado.set(t.id, t)
  const ids = [...estado.keys()]
  let feitas = 0

  const operacao = async () => {
    const id = sortear(ids)
    const t = estado.get(id)
    const quem = sortear(EQUIPE)
    if (!t) return
    const grupos = gruposDa(atribuicoesDa({ ...t, atribuicoes: t.atribuicoes ?? [] }))
    const g = grupos.length ? sortear(grupos) : null
    const x = acaso()
    let r: Resposta | null = null

    if (x < 0.32 && g) {
      const destino = sortear(TODAS_ETAPAS)
      const resps = acaso() < 0.5 ? undefined : acaso() < 0.5 ? null : amostra(EQUIPE, 1 + Math.floor(acaso() * 3)).map((p) => p.id)
      r = await acao(quem, id, { acao: "mover", de: { setor: g.setor, etapa: g.etapa }, para: lugarDe(destino), ...(resps === undefined ? {} : { responsaveis: resps }) })
    } else if (x < 0.42) {
      r = await acao(quem, id, { acao: "adicionar", para: lugarDe(sortear(TODAS_ETAPAS)), responsaveis: amostra(EQUIPE, 1 + Math.floor(acaso() * 2)).map((p) => p.id) })
    } else if (x < 0.62 && g) {
      const parte = sortear(g.abertas)
      r = await acao(quem, id, { acao: "concluirParte", em: { setor: g.setor, etapa: g.etapa }, responsavelId: parte.responsavelId })
    } else if (x < 0.72 && g) {
      r = await acao(quem, id, { acao: "responsaveis", em: { setor: g.setor, etapa: g.etapa }, responsaveis: amostra(EQUIPE, Math.floor(acaso() * 4)).map((p) => p.id) })
    } else if (x < 0.76 && g) {
      r = await acao(quem, id, { acao: "concluirEtapa", em: { setor: g.setor, etapa: g.etapa } })
    } else if (x < 0.81) {
      r = await acao(quem, id, { acao: "concluirMinhaParte" })
    } else if (x < 0.91) {
      const y = acaso()
      const campos =
        y < 0.3 ? { status: acaso() < 0.5 ? "CONCLUIDA" : "PENDENTE" } : y < 0.65 ? { setor: sortear(TIMES_TAREFA) } : { responsavelId: acaso() < 0.2 ? null : sortear(EQUIPE).id }
      r = await chamar("PATCH por fora", quem, "PATCH", `/api/tarefas/${id}`, campos)
      // O PATCH não devolve as partes: a próxima ação nesta tarefa usa o estado velho, como na vida real.
    } else {
      const etapa = sortear(TODAS_ETAPAS)
      const n = await chamar("POST criar", quem, "POST", "/api/tarefas", {
        titulo: `NOVA carga ${feitas}`,
        data: new Date().toISOString().slice(0, 10),
        etapa,
        ...(acaso() < 0.5 ? { responsaveis: amostra(EQUIPE, 1 + Math.floor(acaso() * 2)).map((p) => p.id) } : {}),
      })
      const nova = n.corpo.tarefa as TarefaApi | undefined
      if (nova?.id) {
        estado.set(nova.id, nova)
        ids.push(nova.id)
      }
    }

    if (r?.status === 200 && r.corpo.tarefa) {
      const nova = r.corpo.tarefa as TarefaApi
      if (nova.status === "CONCLUIDA" || nova.status === "CANCELADA") estado.set(id, { ...nova, atribuicoes: [] })
      else estado.set(id, nova)
    }
    feitas++
  }

  const ini = performance.now()
  let proxima = 0
  await Promise.all(
    Array.from({ length: SIMULTANEAS }, async () => {
      while (proxima < N_OPERACOES) {
        proxima++
        await operacao()
      }
    })
  )
  return { feitas, segundos: (performance.now() - ini) / 1000 }
}

// ── Rodada ────────────────────────────────────────────────

async function main() {
  console.log(`Teste em escala do fluxo — ${N_TAREFAS} tarefas, ${N_OPERACOES} operações, ${SIMULTANEAS} ao mesmo tempo`)

  let t0 = performance.now()
  await semear()
  console.log(`• banco semeado em ${((performance.now() - t0) / 1000).toFixed(1)}s`)

  // Antes de qualquer gravação, a tela já põe tudo no lugar pela pasta.
  const antes = await listaDaTela()
  const abertasBanco = Number((await db.query(`select count(*) from tarefas where origem_id like 'teste-escala:%' and status not in ('CONCLUIDA','CANCELADA')`)).rows[0].count)
  confere(antes.length === abertasBanco, `a lista deveria trazer as ${abertasBanco} tarefas abertas (trouxe ${antes.length})`)
  const amarelasPelaPasta = antes.filter((t) => t.pasta === "JUDICIAL › PROTOCOLO NOVO").every((t) =>
    gruposDa(atribuicoesDa({ ...t, atribuicoes: t.atribuicoes ?? [] })).every((g) => g.setor === "AMARELO" && g.etapa === "jud-protocolo")
  )
  confere(amarelasPelaPasta, "JUDICIAL › PROTOCOLO NOVO deveria aparecer em Amarelo › Judicial › Protocolo antes de gravar")

  console.log("• cenários do Zeca")
  await cenarios()
  await invariantes("cenários")

  console.log("• trazer tudo para o fluxo (três administradores ao mesmo tempo)")
  const pend = await chamar("GET pendentes", U.zeca, "GET", "/api/tarefas/fluxo")
  t0 = performance.now()
  const sync = await Promise.all([1, 2, 3].map(() => chamar("POST trazer", U.zeca, "POST", "/api/tarefas/fluxo")))
  console.log(`  ${pend.corpo.semFluxo} pendentes; gravadas ${sync.map((s) => s.corpo.linhas).join(" + ")} linhas em ${((performance.now() - t0) / 1000).toFixed(1)}s`)
  const naoAdmin = await chamar("POST trazer (não admin)", U.tay, "POST", "/api/tarefas/fluxo")
  confere(naoAdmin.status === 403, `só o administrador pode trazer em lote (veio ${naoAdmin.status})`)
  const depois = await chamar("GET pendentes", U.zeca, "GET", "/api/tarefas/fluxo")
  confere(depois.corpo.semFluxo === 0, `depois de trazer, nada deveria faltar (faltam ${depois.corpo.semFluxo})`)
  const semLinha = (await db.query(`select count(*) from tarefas t where origem_id like 'teste-escala:%' and status = 'PENDENTE' and setor in ('VERMELHO','AZUL','AMARELO','ROSA') and not exists (select 1 from tarefa_atribuicoes a where a.tarefa_id = t.id)`)).rows[0].count
  confere(Number(semLinha) === 0, `${semLinha} tarefas abertas de time ficaram fora do fluxo`)
  const movidasPelaPasta = (await db.query(`select count(*) from tarefas t where origem_id like 'teste-escala:%' and pasta = 'JUDICIAL › PROTOCOLO NOVO' and status = 'PENDENTE' and setor <> 'AMARELO'`)).rows[0].count
  confere(Number(movidasPelaPasta) === 0, `${movidasPelaPasta} tarefas do JUDICIAL › PROTOCOLO NOVO continuam fora do amarelo depois de entrar no fluxo`)
  await invariantes("entrada no fluxo")

  console.log(`• carga: ${N_OPERACOES} operações aleatórias, ${SIMULTANEAS} ao mesmo tempo`)
  const c = await carga()
  console.log(`  ${c.feitas} operações em ${c.segundos.toFixed(1)}s (${(c.feitas / c.segundos).toFixed(0)}/s)`)
  const inv = await invariantes("depois da carga")

  const leituras: number[] = []
  for (let i = 0; i < 5; i++) leituras.push((await chamar("GET lista (medida)", U.zeca, "GET", "/api/tarefas?abertas=1&vinculos=1&atribuicoes=1")).ms)

  const linhas = (await db.query(`select count(*) filter (where fim_em is null) as abertas, count(*) as total from tarefa_atribuicoes`)).rows[0]
  console.log("\n── Resultado ──")
  console.log(`partes no banco: ${linhas.total} (${linhas.abertas} abertas, ${inv.gruposAbertos} cartões abertos)`)
  console.log(`leitura da tela: mediana ${percentil(leituras, 50).toFixed(0)} ms, pior ${Math.max(...leituras).toFixed(0)} ms`)
  for (const [op, st] of Object.entries(statusPorOp)) {
    const ms = tempos[op] ?? []
    console.log(`  ${op.padEnd(26)} ${JSON.stringify(st).padEnd(34)} p50 ${percentil(ms, 50).toFixed(0)}ms  p95 ${percentil(ms, 95).toFixed(0)}ms`)
  }
  console.log(`verificações: ${verificacoes}, falhas: ${falhas.length}, erros 5xx: ${erros5xx.length}`)
  for (const f of falhas.slice(0, 30)) console.log("  ✗ " + f)
  for (const e of erros5xx.slice(0, 10)) console.log("  5xx " + e)
  await db.end()
  process.exit(falhas.length || erros5xx.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await db.end()
  process.exit(1)
})
