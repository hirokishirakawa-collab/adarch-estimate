-- 声かけ解放: 解放時に直前の担当者名を残すタグ用カラムを追加
-- すべて nullable・追加のみ（既存行・既存アプリに影響なし）。

ALTER TABLE "leads"
  ADD COLUMN "releasedFromName" TEXT,
  ADD COLUMN "releasedAt"       TIMESTAMP(3);
