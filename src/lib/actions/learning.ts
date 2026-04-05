"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return db.user.findUnique({ where: { email: session.user.email } });
}

async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("ADMIN権限が必要です");
  }
  return user;
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

// ==============================================================
// 管理者向け（ADMIN専用）
// ==============================================================

function revalidateAdmin(courseId?: string) {
  revalidatePath("/dashboard/admin/learning");
  revalidatePath("/dashboard/learning");
  if (courseId) {
    revalidatePath(`/dashboard/admin/learning/${courseId}`);
    revalidatePath(`/dashboard/learning/${courseId}`);
  }
}

// ---- コース ----
export async function createCourse(data: {
  title: string;
  description?: string;
  category: string;
  sortOrder?: number;
}) {
  await requireAdmin();
  const course = await db.learningCourse.create({
    data: {
      title: data.title,
      description: data.description || null,
      category: data.category,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  revalidateAdmin();
  return course;
}

export async function updateCourse(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    category?: string;
    sortOrder?: number;
    published?: boolean;
    mediaType?: string | null;
  }
) {
  await requireAdmin();
  const { mediaType, ...rest } = data;
  const course = await db.learningCourse.update({
    where: { id },
    data: {
      ...rest,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(mediaType !== undefined ? { mediaType: (mediaType || null) as any } : {}),
    },
  });
  revalidateAdmin(id);
  return course;
}

export async function deleteCourse(id: string) {
  await requireAdmin();
  await db.learningCourse.delete({ where: { id } });
  revalidateAdmin();
}

export async function toggleCoursePublished(id: string) {
  await requireAdmin();
  const course = await db.learningCourse.findUnique({ where: { id } });
  if (!course) throw new Error("コースが見つかりません");
  await db.learningCourse.update({
    where: { id },
    data: { published: !course.published },
  });
  revalidateAdmin(id);
}

// ---- レッスン ----
export async function createLesson(data: {
  courseId: string;
  title: string;
  type: string;
  contentUrl?: string;
  body?: string;
  durationMin?: number;
  sortOrder?: number;
}) {
  await requireAdmin();
  const lesson = await db.learningLesson.create({
    data: {
      courseId: data.courseId,
      title: data.title,
      type: data.type,
      contentUrl: data.contentUrl || null,
      body: data.body || null,
      durationMin: data.durationMin ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  revalidateAdmin(data.courseId);
  return lesson;
}

export async function updateLesson(
  id: string,
  data: {
    title?: string;
    type?: string;
    contentUrl?: string | null;
    body?: string | null;
    durationMin?: number | null;
    sortOrder?: number;
  }
) {
  await requireAdmin();
  const lesson = await db.learningLesson.update({ where: { id }, data });
  revalidateAdmin(lesson.courseId);
  return lesson;
}

export async function deleteLesson(id: string) {
  await requireAdmin();
  const lesson = await db.learningLesson.findUnique({ where: { id } });
  if (!lesson) return;
  await db.learningLesson.delete({ where: { id } });
  revalidateAdmin(lesson.courseId);
}

// ---- テスト ----
export async function createTest(data: {
  courseId: string;
  title: string;
  passingScore?: number;
  maxAttempts?: number;
}) {
  await requireAdmin();
  const test = await db.learningTest.create({
    data: {
      courseId: data.courseId,
      title: data.title,
      passingScore: data.passingScore ?? 80,
      maxAttempts: data.maxAttempts ?? 3,
    },
  });
  revalidateAdmin(data.courseId);
  return test;
}

export async function updateTest(
  id: string,
  data: { title?: string; passingScore?: number; maxAttempts?: number }
) {
  await requireAdmin();
  const test = await db.learningTest.update({ where: { id }, data });
  revalidateAdmin(test.courseId);
  return test;
}

export async function deleteTest(id: string) {
  await requireAdmin();
  const test = await db.learningTest.findUnique({ where: { id } });
  if (!test) return;
  await db.learningTest.delete({ where: { id } });
  revalidateAdmin(test.courseId);
}

// ---- 問題 ----
export async function createQuestion(data: {
  testId: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
  sortOrder?: number;
}) {
  await requireAdmin();
  const test = await db.learningTest.findUnique({ where: { id: data.testId } });
  if (!test) throw new Error("テストが見つかりません");
  const question = await db.learningQuestion.create({
    data: {
      testId: data.testId,
      question: data.question,
      choices: JSON.stringify(data.choices),
      correctIndex: data.correctIndex,
      explanation: data.explanation || null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  revalidateAdmin(test.courseId);
  return question;
}

export async function updateQuestion(
  id: string,
  data: {
    question?: string;
    choices?: string[];
    correctIndex?: number;
    explanation?: string | null;
    sortOrder?: number;
  }
) {
  await requireAdmin();
  const { choices, ...rest } = data;
  const q = await db.learningQuestion.update({
    where: { id },
    data: {
      ...rest,
      ...(choices ? { choices: JSON.stringify(choices) } : {}),
    },
  });
  const test = await db.learningTest.findUnique({ where: { id: q.testId } });
  revalidateAdmin(test?.courseId);
  return q;
}

export async function deleteQuestion(id: string) {
  await requireAdmin();
  const q = await db.learningQuestion.findUnique({ where: { id } });
  if (!q) return;
  await db.learningQuestion.delete({ where: { id } });
  const test = await db.learningTest.findUnique({ where: { id: q.testId } });
  revalidateAdmin(test?.courseId);
}
