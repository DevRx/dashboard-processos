#!/usr/bin/env bash
# Preparação única do banco local: schema + defaults + dados de demonstração.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

"$ROOT/scripts/db-local.sh" start
npx prisma db push --accept-data-loss
node scripts/db-defaults.mjs
node --env-file=.env scripts/seed-local.mjs
echo "✓ ambiente local pronto — rode ./scripts/dev-local.sh"
