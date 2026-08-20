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

const PORT = Number(process.env.SUPABASE_LOCAL_PORT ?? 54321)
const PGRST = process.env.PGRST_URL ?? "http://127.0.0.1:3002"
const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(process.env.HOME, ".dashboard-processos-pg", "storage")

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks)
}

/** Encaminha ao PostgREST preservando query, método e cabeçalhos do PostgREST. */
async function proxyRest(req, res, subPath) {
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
  res.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") ?? "application/json",
    "content-range": upstream.headers.get("content-range") ?? "",
  })
  res.end(Buffer.from(await upstream.arrayBuffer()))
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

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost")
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
