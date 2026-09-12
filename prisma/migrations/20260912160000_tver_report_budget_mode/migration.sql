-- 予算の持ち方: PERIOD=期間予算（期間の長さに関係なく使い切る・TVerの主流）/ MONTHLY=月額
ALTER TABLE "tver_delivery_reports" ADD COLUMN "budgetMode" TEXT NOT NULL DEFAULT 'MONTHLY';
