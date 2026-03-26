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

RUN apk add --no-cache openssl ffmpeg python3 py3-pip \
    && pip3 install --break-system-packages yt-dlp

WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

EXPOSE 8080
ENV HOSTNAME="0.0.0.0"
ENV PORT=8080

COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["/start.sh"]
