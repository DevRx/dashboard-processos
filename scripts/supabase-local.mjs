// Gateway compatível com a API do Supabase para desenvolvimento local.
//
// O app fala com o Supabase (PostgREST) em quase toda a camada de dados.
// Sem um projeto Supabase, este gateway serve a mesma superfície em cima
// do Postgres local:
//
//   /rest/v1/*      → PostgREST (mesma semântica de select/eq/order/Prefer)
//   /storage/v1/*   → armazenamento em disco (.storage-local, fora do projeto)
//
// Os cabeçalhos apikey/Authorization são descartados: o PostgREST local
// roda com papel anônimo próprio, sem JWT.
import http from "node:http"
import fs from "node:fs/promises"
import path from "node:path"
import { createReadStream } from "node:fs"
import os from "node:os"

const PORT = Number(process.env.SUPABASE_LOCAL_PORT ?? 54321)
const PGRST = process.env.PGRST_URL ?? "http://127.0.0.1:3002"
const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(os.homedir(), ".dashboard-processos-pg", "storage")

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks)
}

// ── Contagem de idas ao banco ─────────────────────────────
//
// Em produção o app fala com o Supabase pela rede, e cada chamada ao
// PostgREST é uma ida e volta de dezenas de milissegundos. O que decide
// a velocidade de um clique é quantas dessas idas ele faz. Este contador
// (GET /__contagem, com ?zerar=1 para começar de novo) dá esse número
// por rota — é o que o teste de estresse lê.
const contagem = { total: 0, ms: 0, bytes: 0, porRota: {} }
function contar(metodo, subPath, ms, bytes) {
  const rota = `${metodo} ${subPath.split("?")[0]}`
  contagem.total++
  contagem.ms += ms
  contagem.bytes += bytes
  const r = (contagem.porRota[rota] ??= { n: 0, ms: 0, bytes: 0 })
  r.n++
  r.ms += ms
  r.bytes += bytes
}

/** Encaminha ao PostgREST preservando query, método e cabeçalhos do PostgREST. */
async function proxyRest(req, res, subPath) {
  const ini = performance.now()
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readBody(req)
  const headers = {}
  for (const [k, v] of Object.entries(req.headers)) {
    // apikey/authorization/host não valem para o PostgREST local
    if (["apikey", "authorization", "host", "connection", "content-length"].includes(k)) continue
    headers[k] = v
  }
  headers["accept-profile"] = headers["accept-profile"] ?? "public"
  headers["content-profile"] = headers["content-profile"] ?? "public"

  const upstream = await fetch(`${PGRST}${subPath}`, { method: req.method, headers, body })
  const resposta = Buffer.from(await upstream.arrayBuffer())
  contar(req.method, subPath, performance.now() - ini, resposta.length)
  res.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") ?? "application/json",
    "content-range": upstream.headers.get("content-range") ?? "",
  })
  res.end(resposta)
}

/** Storage mínimo: upload, download, remove e URL assinada (sem assinatura real). */
async function handleStorage(req, res, subPath) {
  // /storage/v1/object[/authenticated|/sign|/public]/<bucket>/<caminho...>
  const parts = subPath.replace(/^\/object\/?/, "").split("/").filter(Boolean)
  if (parts[0] === "authenticated" || parts[0] === "public" || parts[0] === "sign") parts.shift()
  const bucket = parts.shift()
  const key = parts.join("/")
  const file = path.join(STORAGE_DIR, bucket ?? "default", key)

  if (subPath.startsWith("/object/sign/")) {
    const token = Buffer.from(`${bucket}/${key}`).toString("base64url")
    res.writeHead(200, { "content-type": "application/json" })
    return res.end(JSON.stringify({ signedURL: `/storage/v1/object/authenticated/${bucket}/${key}?token=${token}` }))
  }

  if (req.method === "POST" || req.method === "PUT") {
    const body = await readBody(req)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, body)
    res.writeHead(200, { "content-type": "application/json" })
    return res.end(JSON.stringify({ Key: `${bucket}/${key}`, path: key }))
  }

  if (req.method === "DELETE") {
    await fs.rm(file, { force: true })
    res.writeHead(200, { "content-type": "application/json" })
    return res.end(JSON.stringify([{ name: key }]))
  }

  try {
    await fs.access(file)
    res.writeHead(200, { "content-type": "application/octet-stream" })
    return createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404, { "content-type": "application/json" })
    return res.end(JSON.stringify({ error: "Object not found" }))
  }
}

const servidor = http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost")
      if (url.pathname === "/__contagem") {
        const foto = JSON.stringify(contagem)
        if (url.searchParams.has("zerar")) {
          contagem.total = contagem.ms = contagem.bytes = 0
          contagem.porRota = {}
        }
        res.writeHead(200, { "content-type": "application/json" })
        return res.end(foto)
      }
      if (url.pathname.startsWith("/rest/v1")) {
        return await proxyRest(req, res, req.url.slice("/rest/v1".length))
      }
      if (url.pathname.startsWith("/storage/v1")) {
        return await handleStorage(req, res, url.pathname.slice("/storage/v1".length))
      }
      res.writeHead(404, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: `rota não suportada: ${url.pathname}` }))
    } catch (err) {
      console.error("[supabase-local]", err)
      res.writeHead(500, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: String(err) }))
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`✓ gateway Supabase local em http://127.0.0.1:${PORT}`))

// Sob carga o cliente reaproveita a conexão no instante em que o padrão
// de 5 s do Node a fecharia — "other side closed". Mais folga que o
// cliente (que fecha as dele antes).
servidor.keepAliveTimeout = 65_000
servidor.headersTimeout = 66_000
