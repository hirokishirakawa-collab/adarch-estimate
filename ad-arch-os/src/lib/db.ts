import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ----------------------------------------------------------------
// Prisma シングルトンパターン（Next.js + Prisma 7 + Driver Adapter）
//
// Prisma 7 では DATABASE_URL を直接読まず、Driver Adapter 経由で接続する。
// 開発環境の HMR でコネクションが枯渇しないようグローバルにキャッシュする。
//
// 【接続先】
//   .env.local の DATABASE_URL を参照する。
//   DB が未接続の場合（Phase 1）はこのファイルを import しないこと。
// ----------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString || connectionString.includes("★")) {
    // DB 未設定時（Phase 1）は接続を試みない
    // API Route 内で db を使う際は DATABASE_URL が設定済みであること
    throw new Error(
      "[db] DATABASE_URL が設定されていません。.env.local に Supabase の接続文字列を設定してください。"
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  // 型エラーを避けるため条件付きで代入
  try {
    globalForPrisma.prisma = db;
  } catch {
    // DB 未設定時は無視（Phase 1）
  }
}
