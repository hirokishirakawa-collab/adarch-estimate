-- 加盟促進コックピット: FranchiseLead にメール下書き欄を追加
-- すべて nullable・追加のみ（既存行・既存アプリに影響なし）

ALTER TABLE "franchise_leads"
  ADD COLUMN "email"          TEXT,
  ADD COLUMN "emailSubject"   TEXT,
  ADD COLUMN "emailBody"      TEXT,
  ADD COLUMN "emailDraftedAt" TIMESTAMP(3);
