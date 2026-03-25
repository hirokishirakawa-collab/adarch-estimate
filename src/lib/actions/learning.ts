"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return db.user.findUnique({ where: { email: session.user.email } });
}

export async function markLessonComplete(lessonId: string) {
  const user = await getUser();
  if (!user) return;

  await db.learningProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    update: { completed: true },
    create: { userId: user.id, lessonId, completed: true },
  });

  revalidatePath("/dashboard/learning");
}

export async function submitTest(
  testId: string,
  answers: number[]
): Promise<{ score: number; passed: boolean; correctAnswers: number[] }> {
  const user = await getUser();
  if (!user) throw new Error("認証が必要です");

  const test = await db.learningTest.findUnique({
    where: { id: testId },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!test) throw new Error("テストが見つかりません");

  // 受験回数チェック
  const attemptCount = await db.learningAttempt.count({
    where: { userId: user.id, testId },
  });
  if (attemptCount >= test.maxAttempts) {
    throw new Error(`受験回数の上限（${test.maxAttempts}回）に達しています`);
  }

  // 採点
  const correctAnswers = test.questions.map((q) => q.correctIndex);
  let correct = 0;
  for (let i = 0; i < test.questions.length; i++) {
    if (answers[i] === correctAnswers[i]) correct++;
  }
  const score = Math.round((correct / test.questions.length) * 100);
  const passed = score >= test.passingScore;

  // 記録
  await db.learningAttempt.create({
    data: {
      userId: user.id,
      testId,
      score,
      passed,
      answers: JSON.stringify(answers),
    },
  });

  // 合格したらenrollmentを完了に
  if (passed) {
    const course = await db.learningCourse.findFirst({
      where: { tests: { some: { id: testId } } },
    });
    if (course) {
      await db.learningEnrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        update: { status: "completed" },
        create: { userId: user.id, courseId: course.id, status: "completed" },
      });
    }
  }

  revalidatePath("/dashboard/learning");
  return { score, passed, correctAnswers };
}
