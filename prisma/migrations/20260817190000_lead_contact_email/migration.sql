-- リードに連絡先メールを持たせる（リード獲得AI側でサイトから取得するため）
-- 追加のみ。既存データ・既存の書き込み経路には影響しない。
ALTER TABLE "leads" ADD COLUMN "email" TEXT;
ALTER TABLE "leads" ADD COLUMN "emailCheckedAt" TIMESTAMP(3);
