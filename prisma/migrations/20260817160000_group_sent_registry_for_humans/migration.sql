-- 「同じ会社に二重に送らない」を、人が送る運用でも効かせる。
--
-- auto_sales_sent_domains は自動営業のために作った表だが、中身は
-- 「グループとして既に当たった会社」なので、送信経路が人に変わっても同じものを使う。
-- 自動営業を廃止（2026-08-17）した結果、この表に書き込む主体が居なくなっていた。
--
-- 変更点:
--   - jobId を NULL 許容に。人が送った分にはジョブが無いため
--   - source / sourceId / sentBy を追加。どの経路の誰が送ったかを残す
--
-- 既存の2行は自動営業由来なので source を AUTO_SALES で埋める。

ALTER TABLE "auto_sales_sent_domains"
  ALTER COLUMN "jobId" DROP NOT NULL;

ALTER TABLE "auto_sales_sent_domains"
  ADD COLUMN "source"   TEXT DEFAULT 'OUTREACH',
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "sentBy"   TEXT;

-- 既存行は自動営業が送ったもの
UPDATE "auto_sales_sent_domains"
SET "source" = 'AUTO_SALES', "sourceId" = "jobId"
WHERE "jobId" IS NOT NULL;
