#!/bin/sh
set -e

# デバッグ: DATABASE_URL の有無を確認
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL is set (length: ${#DATABASE_URL})"
else
  echo "WARNING: DATABASE_URL is NOT set — skipping migration"
fi

# マイグレーションはローカルの prisma db push で適用済み
# standalone モードでは prisma CLI の依存が不足するためスキップ
echo "Skipping migration (applied via prisma db push)"

exec node server.js
