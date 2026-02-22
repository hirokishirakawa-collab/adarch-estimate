FROM node:24-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npm run build

ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "start"]
