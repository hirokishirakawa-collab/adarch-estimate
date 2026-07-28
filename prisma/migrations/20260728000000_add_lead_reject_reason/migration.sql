-- 却下理由: 選定時に本部が外した理由を記録する（AI判定の学習データになる）
-- nullable・追加のみ（既存行・既存アプリに影響なし）。

ALTER TABLE "leads"
  ADD COLUMN "rejectReason" TEXT;
