import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error("[worker/db] DATABASE_URL が設定されていません。");
}

const connectionString = rawUrl.trim().replace(/[?&]pgbouncer=true/i, "");

// 並列レーン数ぶんの接続に、ジョブ取得・集計用の余裕を1つ足す。
// レーンを増やしたのに接続が足りないと、クエリ待ちで並列化の意味がなくなる。
const concurrency = Math.max(1, Number(process.env.CONCURRENCY ?? "3"));

const adapter = new PrismaPg({
  connectionString,
  max: concurrency + 1,
  idleTimeoutMillis: 30_000, // アイドル30秒で切断（先手を打って切る）
  keepAlive: true, // TCP keepaliveで接続断を防ぐ
  keepAliveInitialDelayMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

export const db = new PrismaClient({ adapter });
