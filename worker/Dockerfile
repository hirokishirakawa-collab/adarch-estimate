FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Worker の依存インストール
COPY worker/package.json worker/package-lock.json* ./worker/
RUN cd worker && npm ci

# Prisma スキーマ（本体と共有）→ ローカルと同じ相対パスを維持
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN ln -s /app/worker/node_modules /app/node_modules && npx prisma generate

# Worker ソース
COPY worker/src/ ./worker/src/
COPY worker/tsconfig.json ./worker/

# ビルド（tscがprisma生成ESMファイルをCJSに変換して壊すので、元のファイルで上書き）
RUN cd worker && npx tsc && rm -rf dist/src/generated && cp -r /app/src/generated dist/src/generated

# ヘルスチェック用
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \
  CMD node -e "console.log('ok')" || exit 1

CMD ["node", "worker/dist/index.js"]
