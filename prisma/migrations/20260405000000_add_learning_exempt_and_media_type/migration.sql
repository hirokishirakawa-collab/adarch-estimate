-- AlterTable: Userに学習免除フラグを追加（既存ユーザーは全員 true = 免除）
ALTER TABLE "users" ADD COLUMN "learningExempt" BOOLEAN NOT NULL DEFAULT false;

-- 既存ユーザー全員を免除対象にマーク
UPDATE "users" SET "learningExempt" = true;

-- 今後の新規ユーザーはデフォルト false（テスト合格が必須）
ALTER TABLE "users" ALTER COLUMN "learningExempt" SET DEFAULT false;

-- AlterTable: LearningCourseに媒体タイプを追加
ALTER TABLE "learning_courses" ADD COLUMN "mediaType" "MediaType";
