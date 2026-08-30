#!/usr/bin/env bash
set -euo pipefail

ENV="${1:?Usage: ./scripts/start.sh <env-name> [no-seed]}"
SEED="${2:-}"

[ -f .env ] || { cp .env.example .env; echo "[start] created .env from .env.example"; }
if ! grep -q '^AUTH_SECRET=..*' .env; then
  printf 'AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" >> .env
  echo "[start] generated AUTH_SECRET in .env"
fi

free_port() {
  local p=$1
  while lsof -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; do p=$((p + 1)); done
  echo $p
}

export DB_PORT="$(free_port 5432)"
export APP_PORT="$(free_port 3000)"

docker compose -p "$ENV" up --build -d --force-recreate

URL="http://127.0.0.1:$APP_PORT"
for _ in $(seq 1 60); do
  curl -s -o /dev/null "$URL/api/health" && break
  sleep 2
done

if [ "$SEED" != "no-seed" ]; then
  PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)"
  DATABASE_URL="postgres://finance:$PASSWORD@127.0.0.1:$DB_PORT/finance" \
    npx --yes pnpm@10.12.1 seed
fi

echo "[start] $ENV ready: $URL  (db 127.0.0.1:$DB_PORT)"
echo "        containers: ${ENV}_app / ${ENV}_db   login: demo@finance.local / demo1234"
