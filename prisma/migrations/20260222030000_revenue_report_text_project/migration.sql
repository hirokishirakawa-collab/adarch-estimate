-- projectId FK を削除し、projectName テキスト列に置き換える
ALTER TABLE "revenue_reports" DROP CONSTRAINT IF EXISTS "revenue_reports_projectId_fkey";
ALTER TABLE "revenue_reports" DROP COLUMN IF EXISTS "projectId";
ALTER TABLE "revenue_reports" ADD COLUMN IF NOT EXISTS "projectName" TEXT;
