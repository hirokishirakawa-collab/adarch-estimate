import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error("[worker/db] DATABASE_URL が設定されていません。");
}

const connectionString = rawUrl.trim().replace(/[?&]pgbouncer=true/i, "");

const adapter = new PrismaPg({
  connectionString,
  max: 2, // ワーカーは逐次処理なので2接続で十分
  idleTimeoutMillis: 30_000, // アイドル30秒で切断（先手を打って切る）
  keepAlive: true, // TCP keepaliveで接続断を防ぐ
  keepAliveInitialDelayMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

export const db = new PrismaClient({ adapter });
