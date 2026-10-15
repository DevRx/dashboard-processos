/**
 * Cliques de verdade: vários navegadores, cada um logado como alguém
 * da equipe, abrindo as telas dos times e clicando no kanban —
 * concluir, mover pelo menu, abrir o cartão, criar na coluna, trocar
 * de time — enquanto outras pessoas (simuladas pela API) mexem nas
 * mesmas tarefas.
 *
 * O que sai: o tempo que a tela leva para mostrar os cartões, o tempo
 * entre o clique e a resposta do servidor, erros de console e pedidos
 * que falharam. É a medida que o Zeca sente na cadeira — a da API
 * (estresse.ts) é a que o servidor sente.
 *
 * Uso (com o app em produção local e o banco de teste no ar):
 *
 *   BASE=http://127.0.0.1:3123 DATABASE_URL=postgres://… SESSION_SECRET=… \
 *   [CHROMIUM=/opt/pw-browsers/chromium/chrome] \
 *     npx tsx scripts/teste-fluxo/cliques.ts [navegadores=6] [segundos=60] [carga de fundo=24]
 */
import { chromium, type BrowserContext, type Page } from "playwright"

import { U, EQUIPE, db, chamar, sessao, acaso, sortear, amostra, percentil, listaDaTela, acao, lugarDe, TODAS_ETAPAS, hoje, type Pessoa, type TarefaApi } from "./comum"
import { gruposDa, atribuicoesDa } from "../../lib/domain/tarefa"

const BASE = process.env.BASE ?? "http://localhost:3123"
const NAVEGADORES = Number(process.argv[2] ?? 6)
const SEGUNDOS = Number(process.argv[3] ?? 60)
const CARGA = Number(process.argv[4] ?? 24)
const TIMES = ["vermelho", "azul", "amarelo", "rosa"]

type Medida = { acao: string; ms: number; ok: boolean }
const medidas: Medida[] = []
const navegacoes: { tela: string; ttfb: number; dcl: number; cartoes: number; n: number }[] = []
const problemas: string[] = []
let errosConsole = 0
let pedidosFalhos = 0
let respostas4xx5xx = 0
let prefetchs = 0
let prefetchsAbortados = 0

// ── Carga de fundo pela API: os colegas mexendo nas mesmas tarefas ──

async function cargaDeFundo(fim: number) {
  const tarefas = await listaDaTela(U.zeca, "fundo lista")
  const ids = tarefas.map((t) => t.id)
  const estado = new Map(tarefas.map((t) => [t.id, t]))
  let feitas = 0
  await Promise.all(
    Array.from({ length: CARGA }, async () => {
      while (Date.now() < fim) {
        const quem = sortear(EQUIPE)
        const id = sortear(ids)
        const t = estado.get(id)
        if (!t) { feitas++; continue }
        const grupos = gruposDa(atribuicoesDa({ ...t, atribuicoes: t.atribuicoes ?? [] }))
        const g = grupos.length ? sortear(grupos) : null
        const x = acaso()
        let r
        if (x < 0.4 && g) r = await acao(quem, id, { acao: "mover", de: { setor: g.setor, etapa: g.etapa }, para: lugarDe(sortear(TODAS_ETAPAS)) }, "fundo mover")
        else if (x < 0.7 && g) r = await acao(quem, id, { acao: "concluirParte", em: { setor: g.setor, etapa: g.etapa }, responsavelId: sortear(g.abertas).responsavelId }, "fundo concluir")
        else if (x < 0.85) r = await chamar("fundo criar", quem, "POST", "/api/tarefas", { titulo: `NOVA fundo ${feitas}`, data: hoje(), etapa: sortear(TODAS_ETAPAS), responsaveis: amostra(EQUIPE, 1).map((p) => p.id) })
        else r = await chamar("fundo lista", quem, "GET", "/api/tarefas?abertas=1&vinculos=1&atribuicoes=1")
        if (r?.status === 200 && r.corpo.tarefa) estado.set(id, r.corpo.tarefa as TarefaApi)
        if (r?.status === 201 && r.corpo.tarefa) { const n = r.corpo.tarefa as TarefaApi; estado.set(n.id, n); ids.push(n.id) }
        feitas++
      }
    })
  )
  return feitas
}

// ── Uma pessoa no navegador ───────────────────────────────

async function abrirTela(page: Page, tela: string) {
  const ini = Date.now()
  await page.goto(`${BASE}${tela}`, { waitUntil: "domcontentloaded", timeout: 60000 })
  let cartoes = 0
  try {
    await page.waitForSelector("article[draggable]", { timeout: 45000 })
    cartoes = Date.now() - ini
  } catch {
    problemas.push(`${tela}: os cartões não apareceram em 45 s`)
    cartoes = Date.now() - ini
  }
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    return n ? { ttfb: n.responseStart - n.startTime, dcl: n.domContentLoadedEventEnd - n.startTime } : { ttfb: 0, dcl: 0 }
  })
  const n = await page.locator("article[draggable]").count()
  navegacoes.push({ tela, ttfb: nav.ttfb, dcl: nav.dcl, cartoes, n })
}

/** Espera a resposta do servidor ao clique e mede do clique até ela. */
async function clicar(page: Page, nome: string, rota: RegExp, agir: () => Promise<void>) {
  const ini = performance.now()
  const resposta = page.waitForResponse((r) => rota.test(r.url()) && r.request().method() !== "GET", { timeout: 20000 }).catch(() => null)
  try {
    await agir()
  } catch (e) {
    medidas.push({ acao: nome, ms: performance.now() - ini, ok: false })
    problemas.push(`${nome}: ${String((e as Error).message).split("\n")[0].slice(0, 140)}`)
    return
  }
  const r = await resposta
  const ms = performance.now() - ini
  medidas.push({ acao: nome, ms, ok: Boolean(r && r.status() < 500) })
  if (!r) problemas.push(`${nome}: o servidor não respondeu em 20 s`)
}

async function fecharMenus(page: Page) {
  await page.keyboard.press("Escape").catch(() => {})
  await page.waitForTimeout(80)
}

async function pessoaNoNavegador(ctx: BrowserContext, eu: Pessoa, i: number, fim: number) {
  const page = await ctx.newPage()
  page.on("console", (m) => { if (m.type() === "error") { errosConsole++; if (problemas.length < 60) problemas.push(`console [${eu.name.split(" ")[0]}]: ${m.text().slice(0, 160)}`) } })
  page.on("pageerror", (e) => { errosConsole++; problemas.push(`erro na página [${eu.name.split(" ")[0]}]: ${String(e.message).slice(0, 160)}`) })
  page.on("requestfailed", (r) => {
    // Pré-carregamentos de links (?_rsc=) cancelados por uma navegação não são falhas.
    if (r.failure()?.errorText === "net::ERR_ABORTED" && r.url().includes("_rsc=")) { prefetchsAbortados++; return }
    pedidosFalhos++
    if (problemas.length < 60) problemas.push(`pedido falhou: ${r.method()} ${r.url().replace(BASE, "")} — ${r.failure()?.errorText}`)
  })
  page.on("request", (r) => { if (r.url().includes("_rsc=")) prefetchs++ })
  page.on("response", (r) => { if (r.url().includes("/api/") && r.status() >= 400 && r.status() !== 409) { respostas4xx5xx++; if (problemas.length < 60) problemas.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, "").replace(/[0-9a-f-]{36}/g, "<id>")}`) } })

  let tela = `/times/${TIMES[i % TIMES.length]}`
  await abrirTela(page, tela)

  let cliques = 0
  while (Date.now() < fim) {
    const cards = page.locator("article[draggable]")
    const n = await cards.count()
    if (!n) { await abrirTela(page, tela); continue }
    const card = cards.nth(Math.floor(acaso() * Math.min(n, 40)))
    const x = acaso()
    try {
      // O menu flutuante fecha com qualquer rolagem (components/ui/flutuante.tsx):
      // rola o cartão para a tela antes, e espera a rolagem assentar, como
      // uma pessoa faz — senão o clique abre o menu e a rolagem o fecha.
      await card.scrollIntoViewIfNeeded({ timeout: 5000 })
      await page.waitForTimeout(150)
      if (x < 0.3) {
        // Concluir (se perguntar de quem, o primeiro da lista).
        await clicar(page, "concluir", /\/api\/tarefas\/[^/]+\/fluxo/, async () => {
          await card.locator('button[aria-label^="Concluir"]').click({ timeout: 5000 })
          // O botão pode perguntar "de quem?" e depois "para onde vai?":
          // responde a cada pergunta até o pedido sair (no máximo duas).
          for (let i = 0; i < 2; i++) {
            await page.waitForTimeout(120) // a pergunta aparece depois do clique
            const pergunta = page.getByRole("dialog", { name: "Concluir" })
            if (!(await pergunta.isVisible().catch(() => false))) break
            const botoes = pergunta.locator("button:not([disabled])")
            const n = await botoes.count()
            await botoes.nth(acaso() < 0.5 ? n - 1 : Math.floor(acaso() * n)).click({ timeout: 3000 })
          }
        })
      } else if (x < 0.55) {
        // Mover pelo menu: ações → mover para outra etapa → uma etapa qualquer.
        await clicar(page, "mover pelo menu", /\/api\/tarefas\/[^/]+\/fluxo/, async () => {
          await card.locator('button[aria-label^="Ações da tarefa"]').click({ timeout: 5000 })
          const menu = page.getByRole("dialog", { name: "Ações da tarefa" })
          await menu.getByText("Mover para outra etapa…").click({ timeout: 5000 })
          const opcoes = menu.locator("button:not([disabled])")
          const total = await opcoes.count()
          // O primeiro botão é o "voltar" do título; os demais são lugares.
          await opcoes.nth(1 + Math.floor(acaso() * Math.max(1, total - 1))).click({ timeout: 5000 })
        })
      } else if (x < 0.7) {
        // Abrir o cartão (dúvidas e histórico) e fechar.
        const ini = performance.now()
        await card.locator("button.w-full").first().click({ timeout: 5000 })
        const dialogo = page.getByRole("dialog").last()
        await dialogo.waitFor({ state: "visible", timeout: 10000 })
        medidas.push({ acao: "abrir cartão", ms: performance.now() - ini, ok: true })
        await page.keyboard.press("Escape")
        await page.waitForTimeout(100)
      } else if (x < 0.82) {
        // Nova tarefa na coluna.
        await clicar(page, "criar na coluna", /\/api\/tarefas$/, async () => {
          const mais = page.locator('button[aria-label^="Nova tarefa em"]')
          await mais.nth(Math.floor(acaso() * (await mais.count()))).click({ timeout: 5000 })
          const campo = page.getByLabel("Título da tarefa")
          await campo.fill(`NOVA clique ${eu.name.split(" ")[0]} ${cliques}`, { timeout: 5000 })
          await campo.press("Enter")
        })
      } else if (x < 0.92) {
        // Trocar de time (nova navegação).
        tela = `/times/${sortear(TIMES)}`
        await abrirTela(page, tela)
      } else {
        // Rolar o quadro e procurar.
        await page.mouse.wheel(0, 600)
        await page.waitForTimeout(150)
      }
    } catch (e) {
      problemas.push(`ação falhou [${eu.name.split(" ")[0]}]: ${String((e as Error).message).split("\n")[0].slice(0, 140)}`)
      await fecharMenus(page)
    }
    await fecharMenus(page)
    cliques++
  }
  const heap = await page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0).catch(() => 0)
  await page.close()
  return { cliques, heapMb: Math.round(heap / 1048576) }
}

// ── Rodada ────────────────────────────────────────────────

async function main() {
  console.log(`Cliques reais — ${NAVEGADORES} navegadores por ${SEGUNDOS}s, com ${CARGA} colegas pela API ao fundo`)
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    // Um Chromium já instalado na máquina (CHROMIUM=/caminho/chrome) evita baixar outro.
    ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  })
  const fim = Date.now() + SEGUNDOS * 1000
  const fundo = CARGA > 0 ? cargaDeFundo(fim) : Promise.resolve(0)

  const pessoas = await Promise.all(
    Array.from({ length: NAVEGADORES }, async (_, i) => {
      const eu = EQUIPE[i % EQUIPE.length]
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" })
      await ctx.addCookies([{ name: "session", value: await sessao(eu), url: BASE }])
      const r = await pessoaNoNavegador(ctx, eu, i, fim)
      await ctx.close()
      return { eu: eu.name.split(" ")[0], ...r }
    })
  )
  const feitasAoFundo = await fundo
  await browser.close()

  console.log("\n── Telas (navegação até os cartões aparecerem) ──")
  const porTela = new Map<string, typeof navegacoes>()
  for (const n of navegacoes) (porTela.get(n.tela) ?? porTela.set(n.tela, []).get(n.tela)!).push(n)
  for (const [tela, xs] of porTela) {
    console.log(`  ${tela.padEnd(18)} n=${String(xs.length).padStart(3)}  TTFB p50 ${percentil(xs.map((x) => x.ttfb), 50).toFixed(0).padStart(5)} ms  DOM pronto p50 ${percentil(xs.map((x) => x.dcl), 50).toFixed(0).padStart(5)} ms  cartões na tela p50 ${percentil(xs.map((x) => x.cartoes), 50).toFixed(0).padStart(5)} p95 ${percentil(xs.map((x) => x.cartoes), 95).toFixed(0).padStart(5)} ms  (${Math.round(xs.reduce((s, x) => s + x.n, 0) / xs.length)} cartões)`)
  }

  console.log("\n── Cliques (do clique à resposta do servidor) ──")
  const porAcao = new Map<string, Medida[]>()
  for (const m of medidas) (porAcao.get(m.acao) ?? porAcao.set(m.acao, []).get(m.acao)!).push(m)
  for (const [nome, xs] of porAcao) {
    const ok = xs.filter((x) => x.ok).length
    console.log(`  ${nome.padEnd(18)} n=${String(xs.length).padStart(4)}  ok ${String(ok).padStart(4)}  p50 ${percentil(xs.map((x) => x.ms), 50).toFixed(0).padStart(5)} ms  p95 ${percentil(xs.map((x) => x.ms), 95).toFixed(0).padStart(5)} ms  máx ${Math.max(...xs.map((x) => x.ms)).toFixed(0).padStart(6)} ms`)
  }
  const totalCliques = pessoas.reduce((s, p) => s + p.cliques, 0)
  console.log(`\n  ${totalCliques} ações no navegador (${(totalCliques / SEGUNDOS).toFixed(1)}/s), ${feitasAoFundo} operações dos colegas pela API ao fundo`)
  console.log(`  memória JS por aba ao fim: ${pessoas.map((p) => `${p.eu} ${p.heapMb} MB`).join(", ")}`)
  console.log(`  erros de console: ${errosConsole}, pedidos que falharam: ${pedidosFalhos}, respostas 4xx/5xx (fora 409): ${respostas4xx5xx}`)
  console.log(`  pré-carregamentos de links (?_rsc=) pedidos ao servidor: ${prefetchs} (${prefetchsAbortados} cancelados) em ${navegacoes.length} navegações`)
  const unicos = [...new Set(problemas)]
  for (const p of unicos.slice(0, 25)) console.log("  • " + p)
  if (unicos.length > 25) console.log(`  … e mais ${unicos.length - 25}`)

  await db.end()
  process.exit(errosConsole || pedidosFalhos || respostas4xx5xx ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await db.end()
  process.exit(1)
})
