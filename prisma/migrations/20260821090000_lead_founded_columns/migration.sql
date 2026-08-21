-- 周年ファインダー: リードの設立・創業年を持たせる。
-- 追加のみ。既存行・既存の書き込み経路には影響しない。
--
-- 年しか書いていない会社が大半なので、日付(DATE)ではなく年・月に分けて持つ。
-- 月が取れない会社を 1月1日 で埋めると「1月が周年」という嘘になるため。
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "foundedYear"      INTEGER;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "foundedMonth"     INTEGER;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "foundedRaw"       TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "foundedSource"    TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "foundedSourceUrl" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "foundedCheckedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "leads_foundedYear_idx"      ON "leads"("foundedYear");
CREATE INDEX IF NOT EXISTS "leads_foundedCheckedAt_idx" ON "leads"("foundedCheckedAt");
