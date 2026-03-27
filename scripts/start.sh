#!/bin/sh
set -e

# デバッグ: DATABASE_URL の有無を確認
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL is set (length: ${#DATABASE_URL})"
else
  echo "WARNING: DATABASE_URL is NOT set — skipping migration"
fi

# 本番 DB にマイグレーションを適用（DATABASE_URL が無い場合はスキップ）
if [ -n "$DATABASE_URL" ]; then
  echo "Running prisma migrate deploy..."
  if ! npx prisma migrate deploy; then
    echo "ERROR: Migration failed. Check database connectivity and schema."
    echo "Starting app anyway, but some features may not work correctly."
  else
    echo "Migration done."
  fi
fi

exec node server.js
