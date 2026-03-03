#!/bin/sh
set -e

# 本番 DB にマイグレーションを適用
echo "Running prisma migrate deploy..."
npx prisma migrate deploy
echo "Migration done."

exec npm run start
