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
//   Supabase の Session Mode Pooler URL を使用すること
//   Supabase ダッシュボード > Project Settings > Database > Connection Pooling
//   Mode: Session / Port: 5432
//   例: postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
//
//   ※ Transaction Mode (port 6543) は prepared statements 非対応のため不可
//   ※ Vercel 環境変数に DATABASE_URL として設定してください
// ----------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString || connectionString.includes("★")) {
    throw new Error(
      "[db] DATABASE_URL が設定されていません。.env.local に Supabase の接続文字列を設定してください。"
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    // Vercel Serverless では同時接続数を抑える
    max: process.env.NODE_ENV === "production" ? 3 : 10,
  });

  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  try {
    globalForPrisma.prisma = db;
  } catch {
    // DB 未設定時は無視
  }
}
