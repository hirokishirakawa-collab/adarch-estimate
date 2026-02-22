FROM node:24-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# ビルド時: prisma generate → next build（DATABASE_URL 不要）
RUN npm run build

EXPOSE 8080
ENV HOSTNAME="0.0.0.0"

# 起動時: マイグレーション確認 → アプリ起動（DATABASE_URL が Railway から注入される）
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
