FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Worker の依存インストール
COPY worker/package.json worker/package-lock.json* ./
RUN npm ci

# Prisma スキーマ（本体と共有）
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# Worker ソース
COPY worker/src/ ./src/
COPY worker/tsconfig.json ./

# ビルド
RUN npx tsc

# ヘルスチェック用
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \
  CMD node -e "console.log('ok')" || exit 1

CMD ["node", "dist/index.js"]
