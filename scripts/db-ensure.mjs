// Garante que o banco de dados da aplicação exista no cluster local.
import pg from "pg"

const DB = "dashboard_processos"
const client = new pg.Client({
  host: "127.0.0.1",
  port: 5433,
  user: "postgres",
  password: "postgres",
  database: "postgres",
})

await client.connect()
const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB])
if (rowCount === 0) {
  await client.query(`CREATE DATABASE ${DB}`)
  console.log(`✓ banco "${DB}" criado`)
} else {
  console.log(`✓ banco "${DB}" já existe`)
}
await client.end()
