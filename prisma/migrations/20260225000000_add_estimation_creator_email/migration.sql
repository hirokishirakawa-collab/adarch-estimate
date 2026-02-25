-- AlterTable: 作成者メールアドレスを追加（作成者のみ閲覧制御用）
ALTER TABLE "estimations" ADD COLUMN "createdByEmail" TEXT;

-- CreateIndex
CREATE INDEX "estimations_createdByEmail_idx" ON "estimations"("createdByEmail");
