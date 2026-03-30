FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Worker の依存インストール
COPY worker/package.json worker/package-lock.json* ./worker/
RUN cd worker && npm ci

# Prisma スキーマ（本体と共有）→ ローカルと同じ相対パスを維持
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# Worker ソース
COPY worker/src/ ./worker/src/
COPY worker/tsconfig.json ./worker/

# ビルド
RUN cd worker && npx tsc

# ヘルスチェック用
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \
  CMD node -e "console.log('ok')" || exit 1

CMD ["node", "worker/dist/index.js"]
