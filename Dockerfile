# ---- Build stage ----
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# ---- Production stage ----
FROM node:24-alpine

RUN apk add --no-cache openssl ffmpeg python3 py3-pip py3-numpy py3-pillow su-exec \
    && pip3 install --break-system-packages yt-dlp scipy

# Chromium（HTML→PDF: TVerチラシ制作サポート等）。puppeteer-core から CHROME_PATH で起動する
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto-cjk
ENV CHROME_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/src/lib/video-analysis/scripts ./src/lib/video-analysis/scripts

EXPOSE 8080
ENV HOSTNAME="0.0.0.0"
ENV PORT=8080

COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

# ファイル保存先は Railway Volume（/data）。Railway の環境変数 STORAGE_PATH が同じ値で上書きする
ENV STORAGE_PATH=/data/storage

RUN mkdir -p /app/.next/cache && chmod 777 /app/.next/cache
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# ⚠️ USER appuser はここでは付けない。
#   Volume は起動時に root 所有でマウントされるため、appuser のままだと /data/storage に書けず
#   /tmp/storage に落ちてデプロイで消えていた（2026-09-01 発見）。
#   start.sh が root で所有者を直してから su-exec で appuser に落として node を起動する（非root運用は維持）。

CMD ["/start.sh"]
