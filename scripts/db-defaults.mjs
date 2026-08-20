// Defaults no nível do banco para o ambiente local.
//
// O app grava pela API REST (PostgREST), que não passa por Prisma — logo
// `@default(uuid())` e `@updatedAt`, que são preenchidos pelo cliente
// Prisma, não valem para esses INSERTs. Sem default no banco, qualquer
// criação falha com "null value in column id/updated_at".
import pg from "pg"

const client = new pg.Client({
  host: "127.0.0.1",
  port: 5433,
  user: "postgres",
  password: "postgres",
  database: "dashboard_processos",
})

await client.connect()

const { rows: colunas } = await client.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_default IS NULL
    AND column_name IN ('id', 'created_at', 'updated_at')
`)

let aplicados = 0
for (const { table_name, column_name, data_type } of colunas) {
  const expr =
    column_name === "id"
      ? data_type === "uuid"
        ? "gen_random_uuid()"
        : "gen_random_uuid()::text"
      : "now()"
  await client.query(`ALTER TABLE "${table_name}" ALTER COLUMN "${column_name}" SET DEFAULT ${expr}`)
  aplicados++
}

console.log(`✓ ${aplicados} default(s) aplicados (id → uuid, created_at/updated_at → now())`)
await client.end()
