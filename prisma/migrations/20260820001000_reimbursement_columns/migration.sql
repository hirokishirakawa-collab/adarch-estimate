-- 立替実費（本部手数料の対象外）の2カラム。
-- 対応するコード（747c1c2）が先に本番へ入ったため、後追いで履歴を残す。
-- 実DBへは 2026-08-20 に ALTER で適用済み。どちらも後方互換（既存行に影響しない）。
ALTER TABLE invoice_requests   ADD COLUMN IF NOT EXISTS "reimbursementExclTax" DECIMAL(15,0);
ALTER TABLE payment_statements ADD COLUMN IF NOT EXISTS "reimbursementInclTax" DECIMAL(15,0) NOT NULL DEFAULT 0;
