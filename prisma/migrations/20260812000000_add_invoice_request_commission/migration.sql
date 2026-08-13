-- 請求依頼に本部手数料（ロイヤリティ相殺の原資）を保存する。
-- 本部がクライアントへ代理請求した税抜金額に対する手数料を、請求依頼側にも数値として持たせ、
-- 支払明細(payment_statements.commissionAmount)＝実際に控除した額 と突き合わせられるようにする。
--
-- 追加のみ。既存カラムは不変。
-- commissionRate は既定10%（固定型プランの代表は将来0を入れる）。
-- 既存行の commissionExclTax は、これまでロイヤリティ集計が使っていた式
--   floor(amountExclTax × 10%)
-- と同じ値で埋めるため、集計結果は本マイグレーション前後で変わらない。

-- AlterTable
ALTER TABLE "invoice_requests"
  ADD COLUMN "commissionRate"    DECIMAL(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN "commissionExclTax" DECIMAL(15,0);

-- Backfill: 既存行に現行ロジックと同一の手数料額を埋める
UPDATE "invoice_requests"
SET "commissionExclTax" = FLOOR("amountExclTax" * "commissionRate" / 100)
WHERE "commissionExclTax" IS NULL;
