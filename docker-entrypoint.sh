#!/bin/sh
set -e
echo "[entrypoint] applying migrations…"
node scripts/migrate.cjs
echo "[entrypoint] starting server…"
exec "$@"
