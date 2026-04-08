-- CreateTable: ラーニングコース
CREATE TABLE "learning_courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'onboard',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ラーニングレッスン
CREATE TABLE "learning_lessons" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'video',
    "contentUrl" TEXT,
    "body" TEXT,
    "durationMin" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ラーニングテスト
CREATE TABLE "learning_tests" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "passingScore" INTEGER NOT NULL DEFAULT 80,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ラーニング問題
CREATE TABLE "learning_questions" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "choices" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 受講登録
CREATE TABLE "learning_enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 教材進捗
CREATE TABLE "learning_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable: テスト受験記録
CREATE TABLE "learning_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_lessons_courseId_idx" ON "learning_lessons"("courseId");

-- CreateIndex
CREATE INDEX "learning_tests_courseId_idx" ON "learning_tests"("courseId");

-- CreateIndex
CREATE INDEX "learning_questions_testId_idx" ON "learning_questions"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_enrollments_userId_courseId_key" ON "learning_enrollments"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_progress_userId_lessonId_key" ON "learning_progress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "learning_attempts_userId_testId_idx" ON "learning_attempts"("userId", "testId");

-- AddForeignKey
ALTER TABLE "learning_lessons" ADD CONSTRAINT "learning_lessons_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_tests" ADD CONSTRAINT "learning_tests_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_questions" ADD CONSTRAINT "learning_questions_testId_fkey" FOREIGN KEY ("testId") REFERENCES "learning_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "learning_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_attempts" ADD CONSTRAINT "learning_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_attempts" ADD CONSTRAINT "learning_attempts_testId_fkey" FOREIGN KEY ("testId") REFERENCES "learning_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
