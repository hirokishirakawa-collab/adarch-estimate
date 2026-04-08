#!/bin/sh
set -e

# ストレージディレクトリ作成（Railway Volumeマウント後に実行）
mkdir -p /data/storage/billing-pdfs /data/storage/group-sync-files /data/storage/media-files /data/storage/card-images /data/storage/video-reviews /data/storage/video-reviews/frames /data/storage/creator-avatars 2>/dev/null || true

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
