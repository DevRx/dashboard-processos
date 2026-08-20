#!/usr/bin/env bash
# Sobe todo o ambiente local: Postgres → PostgREST → gateway Supabase → Next.js
# Uso: ./scripts/dev-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOMEDIR="${DASHBOARD_PGDATA:-$HOME/.dashboard-processos-pg}"
LIBPQ="$ROOT/node_modules/@embedded-postgres/darwin-arm64/native/lib"

echo "▸ 1/4 Postgres"
"$ROOT/scripts/db-local.sh" start

echo "▸ 2/4 PostgREST (API REST compatível com Supabase)"
if curl -sf -m 2 http://127.0.0.1:3002/ >/dev/null 2>&1; then
  echo "✓ PostgREST já rodando"
else
  LIBPQ_DIR="$LIBPQ" nohup "$HOMEDIR/run-postgrest.sh" > "$HOMEDIR/postgrest.log" 2>&1 &
  sleep 4
  echo "✓ PostgREST em 127.0.0.1:3002"
fi

echo "▸ 3/4 Gateway Supabase local"
if curl -sf -m 2 http://127.0.0.1:54321/rest/v1/ >/dev/null 2>&1; then
  echo "✓ gateway já rodando"
else
  nohup node "$ROOT/scripts/supabase-local.mjs" > "$HOMEDIR/gateway.log" 2>&1 &
  sleep 2
  echo "✓ gateway em 127.0.0.1:54321"
fi

echo "▸ 4/4 Next.js"
cd "$ROOT" && exec npm run dev
