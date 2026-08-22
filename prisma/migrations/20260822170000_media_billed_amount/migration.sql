-- 媒体ごとの請求費（提示予算）を持たせる。
-- 媒体費実費との差が、本部が手数料を決めるときの材料になる。
--
-- 追加のみ。既定0（媒体請求の実データはまだ無い）。
ALTER TABLE "invoice_request_medias"
  ADD COLUMN IF NOT EXISTS "billedExclTax" DECIMAL(15,0) NOT NULL DEFAULT 0;
