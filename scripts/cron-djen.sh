#!/usr/bin/env bash
# Rotina do DJEN na máquina do escritório.
#
# Chama a rota agendada do dashboard, que busca as intimações da OAB e
# abre as tarefas dos prazos. Serve para rodar por launchd (macOS) ou
# cron; em produção na Vercel, quem chama é o agendador de lá e este
# script não é necessário.
#
# Uso:  ./scripts/cron-djen.sh
# Lê DJEN_CRON_SECRET e DASHBOARD_URL do .env do projeto.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="${DJEN_CRON_LOG:-$HOME/.dashboard-processos-djen.log}"

# shellcheck disable=SC1091
set -a && source "$ROOT/.env" && set +a

URL="${DASHBOARD_URL:-http://localhost:3000}/api/cron/djen"

if [ -z "${DJEN_CRON_SECRET:-}" ]; then
  echo "$(date '+%F %T') ✗ DJEN_CRON_SECRET não configurada no .env" >> "$LOG"
  exit 1
fi

# --max-time protege contra o dia em que o DJEN ficar pendurado: é uma
# rotina de fundo, não pode segurar o agendador por horas.
RESPOSTA="$(curl -sS --max-time 300 -X POST "$URL" \
  -H "x-cron-secret: $DJEN_CRON_SECRET" || echo '{"error":"curl falhou"}')"

echo "$(date '+%F %T') $RESPOSTA" >> "$LOG"
