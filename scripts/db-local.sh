#!/usr/bin/env bash
# Postgres local embarcado para desenvolvimento/demonstração.
# Uso: ./scripts/db-local.sh start|stop|status
#
# O cluster fica FORA do projeto (~/.dashboard-processos-pg) de propósito:
# o socket unix do Postgres dentro da pasta faz o watcher do Turbopack
# quebrar ao tentar lê-lo como arquivo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT/node_modules/@embedded-postgres/darwin-arm64/native/bin"
DATA="${DASHBOARD_PGDATA:-$HOME/.dashboard-processos-pg}"
PORT=5433

case "${1:-start}" in
  start)
    if [ ! -f "$DATA/PG_VERSION" ]; then
      echo "→ inicializando cluster em $DATA"
      mkdir -p "$DATA"
      PWFILE="$(mktemp)"; echo postgres > "$PWFILE"
      "$BIN/initdb" -D "$DATA" -U postgres --pwfile="$PWFILE" -A scram-sha-256 --encoding=UTF8 >/dev/null
      rm -f "$PWFILE"
    fi
    if "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
      echo "✓ Postgres já estava rodando em 127.0.0.1:$PORT"
    else
      "$BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA" -l "$DATA/postgres.log" -w start
    fi
    node "$ROOT/scripts/db-ensure.mjs"
    echo "✓ Postgres pronto em 127.0.0.1:$PORT"
    ;;
  stop)   "$BIN/pg_ctl" -D "$DATA" -w stop ;;
  status) "$BIN/pg_ctl" -D "$DATA" status ;;
  *) echo "uso: $0 start|stop|status" >&2; exit 1 ;;
esac
