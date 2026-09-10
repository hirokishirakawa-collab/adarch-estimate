-- 週次共有 v2（行動量型・2026-09-10）: 旧 q1〜q5 は既定 '' に、v2 列を追加
ALTER TABLE "weekly_submissions"
  ALTER COLUMN "q1" SET DEFAULT '',
  ALTER COLUMN "q2" SET DEFAULT '',
  ALTER COLUMN "q3" SET DEFAULT '',
  ALTER COLUMN "q4" SET DEFAULT '',
  ALTER COLUMN "q5" SET DEFAULT '',
  ADD COLUMN "formVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'FORM',
  ADD COLUMN "outreachCount" INTEGER,
  ADD COLUMN "repliedCount" INTEGER,
  ADD COLUMN "candidate" TEXT,
  ADD COLUMN "followUp" TEXT,
  ADD COLUMN "followUpNote" TEXT,
  ADD COLUMN "hqRequest" TEXT,
  ADD COLUMN "hqNote" TEXT;
