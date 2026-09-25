// Modo demonstração: o sistema inteiro com um comando, em qualquer máquina.
//
//   npm run demo
//
// Existe porque o ambiente local de antes (`dev-local.sh`) só rodava no
// Mac — os binários do Postgres eram os de darwin-arm64 — e, fora dele,
// `npm run dev` subia o Next sem banco nenhum atrás. A tela de login
// carregava normalmente e, ao entrar, respondia "Erro interno do
// servidor": o Supabase que o `.env` apontava simplesmente não existia.
//
// Aqui nada depende do sistema operacional nem de conta na nuvem:
//
//   PGlite (Postgres compilado para WebAssembly, roda dentro do Node)
//     → PostgREST (a mesma API REST que o Supabase usa; baixado uma vez)
//       → gateway Supabase local (scripts/supabase-local.mjs)
//         → Next.js em http://localhost:3000
//
// Na primeira execução o banco é criado, recebe o schema do Prisma e os
// dados de demonstração. Nas seguintes, os dados continuam lá. Tudo fica
// em ~/.dashboard-processos-demo — apagar a pasta recomeça do zero.
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const HOME = process.env.DASHBOARD_DEMO_DIR ?? path.join(os.homedir(), ".dashboard-processos-demo")
const PG_PORT = Number(process.env.DEMO_PG_PORT ?? 54329)
const PGRST_PORT = Number(process.env.DEMO_PGRST_PORT ?? 3002)
const GATEWAY_PORT = Number(process.env.SUPABASE_LOCAL_PORT ?? 54321)
const APP_PORT = Number(process.env.PORT ?? 3000)

const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres?sslmode=disable&connection_limit=1`

// Segredo fixo de propósito: é demonstração, e um segredo estável mantém
// a sessão válida entre uma execução e outra.
const DEMO_ENV = {
  SUPABASE_URL: `http://127.0.0.1:${GATEWAY_PORT}`,
  SUPABASE_SECRET_KEY: "demo-local",
  SESSION_SECRET: "demo-local-sessao-nao-use-em-producao-0123456789",
}

const filhos = []

function passo(msg) {
  console.log(`▸ ${msg}`)
}

// Assíncrono de propósito: o banco é servido por este mesmo processo, e
// um spawnSync travaria o event loop — o Prisma esperaria para sempre
// por um banco que não pode responder.
function node(script, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, ...env },
    })
    p.on("error", reject)
    p.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`falhou: ${path.relative(ROOT, script)} ${args.join(" ")}`))
    )
  })
}

function portaLivre(porta) {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.once("error", () => resolve(false))
    s.once("listening", () => s.close(() => resolve(true)))
    s.listen(porta, "127.0.0.1")
  })
}

async function esperar(url, tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error(`não respondeu: ${url}`)
}

// ── PostgREST ───────────────────────────────────────────────────────
// Um binário por plataforma. O Mac Intel ficou na 12.2.3 porque a 13
// não publica mais essa build.
const PGRST_RELEASES = {
  "win32-x64": "v13.0.5/postgrest-v13.0.5-windows-x86-64.zip",
  "linux-x64": "v13.0.5/postgrest-v13.0.5-linux-static-x86-64.tar.xz",
  "linux-arm64": "v13.0.5/postgrest-v13.0.5-ubuntu-aarch64.tar.xz",
  "darwin-arm64": "v13.0.5/postgrest-v13.0.5-macos-aarch64.tar.xz",
  "darwin-x64": "v12.2.3/postgrest-v12.2.3-macos-x64.tar.xz",
}

async function garantirPostgrest() {
  if (process.env.POSTGREST_BIN) return process.env.POSTGREST_BIN

  const exe = path.join(HOME, process.platform === "win32" ? "postgrest.exe" : "postgrest")
  if (fs.existsSync(exe)) return exe

  const alvo = PGRST_RELEASES[`${process.platform}-${process.arch}`]
  if (!alvo) {
    throw new Error(
      `sem PostgREST para ${process.platform}-${process.arch}. Baixe em ` +
        "https://github.com/PostgREST/postgrest/releases e aponte POSTGREST_BIN para ele."
    )
  }

  const url = `https://github.com/PostgREST/postgrest/releases/download/${alvo}`
  const arquivo = path.join(HOME, path.basename(alvo))
  passo(`baixando o PostgREST (só na primeira vez) — ${path.basename(alvo)}`)

  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    fs.writeFileSync(arquivo, Buffer.from(await resp.arrayBuffer()))
  } catch {
    // Atrás de proxy o fetch do Node não enxerga HTTPS_PROXY; o curl
    // enxerga, e existe no Windows 10+, no Mac e no Linux.
    const r = spawnSync("curl", ["-fsSL", "-o", arquivo, url], { stdio: "inherit" })
    if (r.status !== 0) throw new Error(`não consegui baixar ${url}`)
  }

  // `tar` abre .zip e .tar.xz no Windows 10+, no Mac e no Linux.
  const r = spawnSync("tar", ["-xf", arquivo, "-C", HOME], { stdio: "inherit" })
  if (r.status !== 0 || !fs.existsSync(exe)) throw new Error(`não consegui extrair ${arquivo}`)
  fs.rmSync(arquivo, { force: true })
  if (process.platform !== "win32") fs.chmodSync(exe, 0o755)
  return exe
}

// ── Banco ───────────────────────────────────────────────────────────
async function prepararBanco(db) {
  const marca = path.join(HOME, ".preparado")
  if (fs.existsSync(marca)) return

  passo("criando o schema (prisma db push)")
  const prisma = path.join(ROOT, "node_modules", "prisma", "build", "index.js")
  await node(prisma, ["db", "push", "--accept-data-loss", "--skip-generate"], {
    DATABASE_URL,
    DIRECT_URL: DATABASE_URL,
  })

  // O app grava pela API REST, que não passa pelo Prisma — então
  // `@default(uuid())` e `@updatedAt` precisam existir no próprio banco.
  // Mesma regra de scripts/db-defaults.mjs.
  const { rows: colunas } = await db.query(`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and column_default is null
      and column_name in ('id', 'created_at', 'updated_at')
  `)
  for (const { table_name, column_name, data_type } of colunas) {
    const expr =
      column_name === "id"
        ? data_type === "uuid"
          ? "gen_random_uuid()"
          : "gen_random_uuid()::text"
        : "now()"
    await db.exec(`alter table "${table_name}" alter column "${column_name}" set default ${expr}`)
  }

  passo("gerando o cliente do Prisma e inserindo os dados de demonstração")
  if (!fs.existsSync(path.join(ROOT, "node_modules", ".prisma", "client", "index.js"))) {
    await node(prisma, ["generate"])
  }
  await node(path.join(ROOT, "scripts", "seed-local.mjs"), [], { DATABASE_URL })
  // Os 10 clientes de teste povoam as sete famílias do Administrativo.
  await db.exec(fs.readFileSync(path.join(ROOT, "scripts", "clientes-de-teste.sql"), "utf8"))

  fs.writeFileSync(marca, new Date().toISOString())
}

async function papelAnonimo(db) {
  // O PostgREST entra como `anon`. Refeito a cada subida para cobrir
  // tabela nova depois de um `git pull`.
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
    end $$;
    grant usage on schema public to anon;
    grant all on all tables in schema public to anon;
    grant all on all sequences in schema public to anon;
  `)
}

// ── Subida ──────────────────────────────────────────────────────────
function iniciar(nome, cmd, args, env = {}) {
  const log = fs.openSync(path.join(HOME, `${nome}.log`), "a")
  const p = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", log, log],
  })
  p.on("exit", (code) => {
    if (!encerrando) {
      console.error(`✗ ${nome} parou (código ${code}) — veja ${path.join(HOME, `${nome}.log`)}`)
      encerrar(1)
    }
  })
  filhos.push(p)
  return p
}

let encerrando = false
let servidor
let db

async function encerrar(codigo = 0) {
  if (encerrando) return
  encerrando = true
  for (const p of filhos) p.kill()
  await servidor?.stop().catch(() => {})
  await db?.close().catch(() => {})
  process.exit(codigo)
}

process.on("SIGINT", () => encerrar(0))
process.on("SIGTERM", () => encerrar(0))

async function main() {
  fs.mkdirSync(HOME, { recursive: true })

  for (const [nome, porta] of [
    ["banco", PG_PORT],
    ["PostgREST", PGRST_PORT],
    ["gateway Supabase", GATEWAY_PORT],
    ["Next.js", APP_PORT],
  ]) {
    if (!(await portaLivre(porta))) {
      throw new Error(
        `a porta ${porta} (${nome}) já está em uso. Feche o que estiver nela — ` +
          "outro `npm run dev`, por exemplo — e rode de novo."
      )
    }
  }

  const postgrest = await garantirPostgrest()

  passo("1/4 banco (PGlite)")
  db = new PGlite(path.join(HOME, "pgdata"))
  await db.waitReady
  servidor = new PGLiteSocketServer({ db, port: PG_PORT, host: "127.0.0.1", maxConnections: 20 })
  await servidor.start()
  await prepararBanco(db)
  await papelAnonimo(db)

  passo("2/4 PostgREST")
  iniciar("postgrest", postgrest, [], {
    PGRST_DB_URI: DATABASE_URL.replace("&connection_limit=1", ""),
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_DB_SCHEMAS: "public",
    PGRST_SERVER_HOST: "127.0.0.1",
    PGRST_SERVER_PORT: String(PGRST_PORT),
    // O PGlite atende todas as conexões numa sessão só: com mais de uma
    // no pool, as transações (e os prepared statements) de uma
    // atropelariam as da outra.
    PGRST_DB_POOL: "1",
    PGRST_DB_PREPARED_STATEMENTS: "false",
    PGRST_DB_CHANNEL_ENABLED: "false",
  })
  await esperar(`http://127.0.0.1:${PGRST_PORT}/`)

  passo("3/4 gateway Supabase local")
  iniciar("gateway", process.execPath, [path.join(ROOT, "scripts", "supabase-local.mjs")], {
    SUPABASE_LOCAL_PORT: String(GATEWAY_PORT),
    PGRST_URL: `http://127.0.0.1:${PGRST_PORT}`,
    STORAGE_DIR: path.join(HOME, "storage"),
  })
  await esperar(`http://127.0.0.1:${GATEWAY_PORT}/rest/v1/`)

  passo("4/4 Next.js")
  const next = path.join(ROOT, "node_modules", "next", "dist", "bin", "next")
  const app = spawn(process.execPath, [next, "dev", "-p", String(APP_PORT)], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...DEMO_ENV },
  })
  app.on("exit", (code) => encerrar(code ?? 0))
  filhos.push(app)

  console.log(`
  ✓ Demonstração em http://localhost:${APP_PORT}

    Admin       admin@advocacia.com       admin123
    Advogado    advogado@advocacia.com    advogado123
    Assistente  assistente@advocacia.com  assistente123

  Ctrl+C encerra tudo. Os dados ficam em ${HOME}.
`)
}

main().catch((erro) => {
  console.error(`\n✗ ${erro.message}`)
  encerrar(1)
})
