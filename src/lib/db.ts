import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ----------------------------------------------------------------
// Prisma シングルトンパターン（Next.js + Prisma 7 + Driver Adapter）
//
// 【開発環境】
//   DATABASE_URL に Supabase の Direct 接続文字列を設定
//   例: postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
//
// 【本番環境（Vercel Serverless）】
//   Supabase の Transaction Mode Pooler URL を使用すること
//   Supabase ダッシュボード > Project Settings > Database > Connection Pooling
//   Mode: Transaction / Port: 6543
//   例: postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true
//
//   ※ @prisma/adapter-pg は prepared statements を使わないため Transaction Mode 対応
//   ※ Vercel Serverless では max:1 が適切（各インスタンスが独立した接続を持つ）
//   ※ Vercel 環境変数に DATABASE_URL として設定してください
// ----------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl || rawUrl.includes("★")) {
    throw new Error(
      "[db] DATABASE_URL が設定されていません。.env.local に Supabase の接続文字列を設定してください。"
    );
  }

  // 末尾の改行・空白を除去し、?pgbouncer=true は pg ライブラリに渡す前に除去する
  const connectionString = rawUrl.trim().replace(/[?&]pgbouncer=true/i, "");

  const adapter = new PrismaPg({
    connectionString,
    // Transaction Mode Serverless: 各 Lambda インスタンスは接続 1 本で十分
    max: process.env.NODE_ENV === "production" ? 1 : 10,
  });

  return new PrismaClient({ adapter });
}

// Lazy singleton — モジュール読み込み時ではなく、最初に使われた時点で接続する
// これにより Next.js のビルド時（DATABASE_URL 未設定）にクラッシュしなくなる
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    const value = (globalForPrisma.prisma as unknown as Record<string | symbol, unknown>)[prop as string | symbol];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(globalForPrisma.prisma)
      : value;
  },
});
