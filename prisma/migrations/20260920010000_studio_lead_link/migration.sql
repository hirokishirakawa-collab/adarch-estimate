-- Ad Arch Studio: 依頼を営業の流れ（リード）に乗せる（追加のみ）
-- ⚠️ ALTER TYPE ... ADD VALUE はトランザクションの外で実行する（psql なら BEGIN で囲まない）

-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'STUDIO_MCP';

-- AlterTable
ALTER TABLE "studio_inquiries" ADD COLUMN IF NOT EXISTS "customerId" TEXT,
ADD COLUMN IF NOT EXISTS "leadId" TEXT;
