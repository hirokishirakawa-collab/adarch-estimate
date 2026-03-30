import { PrismaClient } from "../../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error("[worker/db] DATABASE_URL が設定されていません。");
}

const connectionString = rawUrl.trim().replace(/[?&]pgbouncer=true/i, "");

const adapter = new PrismaPg({
  connectionString,
  max: 2, // ワーカーは逐次処理なので2接続で十分
});

export const db = new PrismaClient({ adapter });
