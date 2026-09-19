-- Ad Arch Studio: ご利用条件への同意と版を依頼に残す（追加のみ）

-- AlterTable
ALTER TABLE "studio_inquiries" ADD COLUMN IF NOT EXISTS "termsAgreedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
