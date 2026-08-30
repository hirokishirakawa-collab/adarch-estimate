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

RUN apk add --no-cache openssl ffmpeg python3 py3-pip py3-numpy py3-pillow \
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

ENV STORAGE_PATH=/tmp/storage

RUN mkdir -p /app/.next/cache && chmod 777 /app/.next/cache
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["/start.sh"]
