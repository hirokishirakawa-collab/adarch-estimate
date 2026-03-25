import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChevronLeft, Play, FileText, CheckCircle, Lock, ClipboardCheck } from "lucide-react";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";
import { LessonCompleteButton } from "./lesson-complete-button";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default async function CoursePage({ params }: PageProps) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({ where: { email: session.user.email! } });
  if (!user) redirect("/login");

  const course = await db.learningCourse.findUnique({
    where: { id: courseId },
    include: {
      lessons: { orderBy: { sortOrder: "asc" } },
      tests: {
        include: {
          questions: { select: { id: true } },
        },
      },
    },
  });
  if (!course) notFound();

  // 進捗取得
  const progress = await db.learningProgress.findMany({
    where: { userId: user.id, lesson: { courseId } },
  });
  const completedIds = new Set(progress.filter((p) => p.completed).map((p) => p.lessonId));

  // テスト合否
  const bestAttempts = await db.learningAttempt.findMany({
    where: { userId: user.id, test: { courseId } },
    orderBy: { score: "desc" },
  });
  const passedTestIds = new Set(bestAttempts.filter((a) => a.passed).map((a) => a.testId));

  const allLessonsComplete = course.lessons.length > 0 && course.lessons.every((l) => completedIds.has(l.id));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href="/dashboard/learning"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        コース一覧に戻る
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h1 className="text-xl font-bold text-zinc-900 mb-2">{course.title}</h1>
        {course.description && (
          <p className="text-sm text-zinc-500">{course.description}</p>
        )}
        <div className="flex items-center gap-4 mt-4 text-xs text-zinc-400">
          <span>{course.lessons.length} 教材</span>
          <span>{completedIds.size}/{course.lessons.length} 完了</span>
          <span>{course.tests.length} テスト</span>
        </div>
      </div>

      {/* Lessons */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-zinc-700 mb-3">教材</h2>
        <div className="space-y-2">
          {course.lessons.map((lesson, i) => {
            const done = completedIds.has(lesson.id);
            const icon = lesson.type === "video" ? Play : FileText;
            const Icon = icon;
            return (
              <div
                key={lesson.id}
                className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${done ? "border-emerald-200" : ""}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? "bg-emerald-50" : "bg-zinc-50"}`}>
                  {done ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Icon className="w-5 h-5 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800">{i + 1}. {lesson.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-zinc-400">{lesson.type === "video" ? "動画" : lesson.type === "pdf" ? "PDF" : "テキスト"}</span>
                    {lesson.durationMin && <span className="text-[11px] text-zinc-400">約{lesson.durationMin}分</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lesson.contentUrl && (
                    <a
                      href={lesson.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      {lesson.type === "video" ? "再生" : "開く"}
                    </a>
                  )}
                  {!done && (
                    <LessonCompleteButton lessonId={lesson.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tests */}
      {course.tests.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-zinc-700 mb-3">テスト</h2>
          <div className="space-y-2">
            {course.tests.map((test) => {
              const passed = passedTestIds.has(test.id);
              const canTake = allLessonsComplete;
              return (
                <div
                  key={test.id}
                  className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${passed ? "border-blue-200" : ""}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${passed ? "bg-blue-50" : canTake ? "bg-zinc-50" : "bg-zinc-100"}`}>
                    {passed ? (
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                    ) : canTake ? (
                      <ClipboardCheck className="w-5 h-5 text-zinc-400" />
                    ) : (
                      <Lock className="w-5 h-5 text-zinc-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-800">{test.title}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {test.questions.length}問 · 合格ライン {test.passingScore}%
                      {passed && " · 合格済み"}
                    </p>
                  </div>
                  {canTake && !passed ? (
                    <Link
                      href={`/dashboard/learning/${courseId}/test?testId=${test.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      受験する
                    </Link>
                  ) : !canTake && !passed ? (
                    <span className="text-[11px] text-zinc-400">全教材を完了してください</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
