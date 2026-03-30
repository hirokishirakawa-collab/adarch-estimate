FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Worker の依存インストール
COPY worker/package.json worker/package-lock.json* ./worker/
RUN cd worker && npm ci

# Prisma スキーマ → 生成
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN ln -s /app/worker/node_modules /app/node_modules && npx prisma generate

# Worker ソース
COPY worker/src/ ./worker/src/
COPY worker/tsconfig.json ./worker/

# 生成済みクライアントを worker/src 配下にコピー（tscの型解決用）
RUN cp -r /app/src/generated /app/worker/src/generated

# ビルド → 生成ファイルは tsc を通さず dist に直接コピー
RUN cd worker && npx tsc && cp -r src/generated dist/generated

# ヘルスチェック用
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \
  CMD node -e "console.log('ok')" || exit 1

CMD ["node", "worker/dist/index.js"]
