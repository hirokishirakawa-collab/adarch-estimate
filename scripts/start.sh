#!/bin/sh
set -e

# ---------------------------------------------------------------
# 起動手順（root → appuser）
#   1. root のうちに Volume 上の保存先（STORAGE_PATH）を作り、所有者を appuser に直す
#      （Volume は root 所有でマウントされるため。appuser のままだと書けず /tmp に落ちていた）
#   2. su-exec で appuser に落として node を起動（非root運用は維持）
#   root で起動していない／su-exec が無い環境ではそのまま起動する（ローカル・旧構成の互換）
# ---------------------------------------------------------------
STORAGE_ROOT="${STORAGE_PATH:-/data/storage}"
BUCKETS="billing-pdfs group-sync-files media-files card-images video-reviews video-reviews/frames creator-avatars signage-assets"

if [ "$(id -u)" = "0" ]; then
  for b in $BUCKETS; do mkdir -p "$STORAGE_ROOT/$b" 2>/dev/null || true; done
  if id appuser >/dev/null 2>&1; then
    chown -R appuser:appgroup "$STORAGE_ROOT" 2>/dev/null || echo "WARNING: chown $STORAGE_ROOT failed"
  fi
fi

# 書けるかを起動ログに残す（Railway のログで確認できる）
if [ "$(id -u)" = "0" ] && command -v su-exec >/dev/null 2>&1 && id appuser >/dev/null 2>&1; then
  if su-exec appuser sh -c "touch '$STORAGE_ROOT/.write-test' && rm -f '$STORAGE_ROOT/.write-test'"; then
    echo "[start] storage writable by appuser: $STORAGE_ROOT"
  else
    echo "[start] WARNING: storage NOT writable by appuser: $STORAGE_ROOT (falls back to /tmp)"
  fi
fi

# デバッグ: DATABASE_URL の有無を確認
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL is set (length: ${#DATABASE_URL})"
else
  echo "WARNING: DATABASE_URL is NOT set — skipping migration"
fi

# マイグレーションはローカルの prisma db push で適用済み
# standalone モードでは prisma CLI の依存が不足するためスキップ
echo "Skipping migration (applied via prisma db push)"

if [ "$(id -u)" = "0" ] && command -v su-exec >/dev/null 2>&1 && id appuser >/dev/null 2>&1; then
  echo "[start] dropping privileges to appuser"
  exec su-exec appuser node server.js
fi
exec node server.js
