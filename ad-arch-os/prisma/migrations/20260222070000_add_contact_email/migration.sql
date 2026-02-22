-- 請求先担当者メールアドレスを追加（既存行は空文字で埋めてから NOT NULL 化）

ALTER TABLE "invoice_requests"
  ADD COLUMN "contactEmail" TEXT NOT NULL DEFAULT '';

-- デフォルト値を外す（新規登録時は必ず入力させる）
ALTER TABLE "invoice_requests"
  ALTER COLUMN "contactEmail" DROP DEFAULT;
