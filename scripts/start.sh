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
  ./node_modules/.bin/prisma migrate deploy || echo "Migration failed (non-fatal), continuing..."
  echo "Migration done."
fi

exec npm run start
