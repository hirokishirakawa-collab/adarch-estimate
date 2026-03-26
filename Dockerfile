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

COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./

EXPOSE 8080
ENV HOSTNAME="0.0.0.0"

COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
