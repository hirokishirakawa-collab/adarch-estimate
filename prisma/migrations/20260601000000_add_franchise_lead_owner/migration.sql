-- 加盟リード管理: FranchiseLead に担当者（誰が拾ったか）を追加
-- すべて nullable・追加のみ（既存行・既存アプリに影響なし）。既存行は owner=null＝本部扱い。

ALTER TABLE "franchise_leads"
  ADD COLUMN "ownerEmail" TEXT,
  ADD COLUMN "ownerName"  TEXT;

CREATE INDEX "franchise_leads_ownerEmail_idx" ON "franchise_leads"("ownerEmail");
