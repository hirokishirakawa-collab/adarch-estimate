-- 請求申請に種別（通常請求 / 媒体請求）を持たせる。
-- 媒体請求は取り分の条件が案件ごとに違うため、本部手数料を自動計算しない。
--
-- 追加のみ。既存行はすべて NORMAL になるので、過去のロイヤリティ集計結果は変わらない。
DO $$ BEGIN
  CREATE TYPE "InvoiceRequestKind" AS ENUM ('NORMAL', 'MEDIA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "invoice_requests"
  ADD COLUMN IF NOT EXISTS "kind" "InvoiceRequestKind" NOT NULL DEFAULT 'NORMAL';

CREATE INDEX IF NOT EXISTS "invoice_requests_kind_idx" ON "invoice_requests"("kind");
