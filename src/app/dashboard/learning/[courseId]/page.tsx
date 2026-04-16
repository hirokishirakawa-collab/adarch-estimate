import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ChevronLeft, Play, FileText, CheckCircle, ClipboardCheck,
  BookOpen, ArrowRight, RotateCcw,
} from "lucide-react";
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

  // テスト合否・受験回数
  const attempts = await db.learningAttempt.findMany({
    where: { userId: user.id, test: { courseId } },
    orderBy: { createdAt: "desc" },
  });
  const passedTestIds = new Set(attempts.filter((a) => a.passed).map((a) => a.testId));
  const attemptCountByTest = new Map<string, number>();
  const bestScoreByTest = new Map<string, number>();
  for (const a of attempts) {
    attemptCountByTest.set(a.testId, (attemptCountByTest.get(a.testId) ?? 0) + 1);
    const prev = bestScoreByTest.get(a.testId) ?? 0;
    if (a.score > prev) bestScoreByTest.set(a.testId, a.score);
  }

  const completedCount = course.lessons.filter((l) => completedIds.has(l.id)).length;
  const totalSteps = course.lessons.length + course.tests.length;
  const passedCount = course.tests.filter((t) => passedTestIds.has(t.id)).length;
  const doneSteps = completedCount + passedCount;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href="/dashboard/learning"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        コース一覧
      </Link>

      {/* Header Card */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-bold mb-1">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-zinc-400">{course.description}</p>
            )}
          </div>
          {passedCount === course.tests.length && course.tests.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 rounded-lg">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">修了</span>
            </div>
          )}
        </div>
        {/* Progress */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">{doneSteps}/{totalSteps} 完了</span>
            <span className="text-xs font-bold text-zinc-300">{totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0}%</span>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="space-y-0">
        {/* Lessons */}
        {course.lessons.map((lesson, i) => {
          const done = completedIds.has(lesson.id);
          const isVideo = lesson.type === "video";
          const hasUrl = !!lesson.contentUrl;

          return (
            <div key={lesson.id} className="relative">
              {/* Connector line */}
              {(i > 0 || true) && i < course.lessons.length + course.tests.length && (
                <div className="absolute left-[27px] top-0 bottom-0 w-px bg-zinc-200" />
              )}

              <div className="relative flex gap-4 pb-4">
                {/* Step indicator */}
                <div className={`relative z-10 w-[55px] flex-shrink-0 flex flex-col items-center pt-4`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    done
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-zinc-300 bg-white"
                  }`}>
                    {done ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : isVideo ? (
                      <Play className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1">STEP {i + 1}</span>
                </div>

                {/* Content card */}
                <div className={`flex-1 bg-white rounded-xl border p-4 mt-2 ${done ? "border-emerald-200" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-zinc-800">{lesson.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">
                        {isVideo ? "動画" : lesson.type === "pdf" ? "PDF" : "テキスト"}
                        {lesson.durationMin ? ` · 約${lesson.durationMin}分` : ""}
                      </span>
                    </div>
                  </div>

                  {/* External link for PDF / video */}
                  {hasUrl && (
                    <a
                      href={lesson.contentUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" /> {isVideo ? "動画を開く" : "教材を開く"}
                    </a>
                  )}

                  {/* Text lesson body */}
                  {lesson.body && (
                    <div className="mt-3 text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                      {lesson.body}
                    </div>
                  )}

                  {/* Complete button */}
                  {!done && (
                    <div className="mt-3">
                      <LessonCompleteButton lessonId={lesson.id} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Tests */}
        {course.tests.map((test, ti) => {
          const passed = passedTestIds.has(test.id);
          const count = attemptCountByTest.get(test.id) ?? 0;
          const bestScore = bestScoreByTest.get(test.id) ?? 0;
          const maxReached = count >= test.maxAttempts;
          const stepNum = course.lessons.length + ti + 1;

          return (
            <div key={test.id} className="relative">
              <div className="absolute left-[27px] top-0 h-4 w-px bg-zinc-200" />

              <div className="relative flex gap-4">
                {/* Step indicator */}
                <div className="relative z-10 w-[55px] flex-shrink-0 flex flex-col items-center pt-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    passed
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-blue-400 bg-blue-50"
                  }`}>
                    {passed ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ClipboardCheck className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1">STEP {stepNum}</span>
                </div>

                {/* Test card */}
                <div className={`flex-1 rounded-xl border p-5 mt-2 ${
                  passed ? "bg-emerald-50/50 border-emerald-200" : "bg-blue-50/30 border-blue-200"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">テスト</span>
                        {passed && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">合格</span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-zinc-800">{test.title}</h3>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        {test.questions.length}問 · 合格ライン {test.passingScore}% · 最大{test.maxAttempts}回
                      </p>
                      {count > 0 && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          受験{count}回 · ベスト {bestScore}%
                        </p>
                      )}
                    </div>

                    <div>
                      {passed ? (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-emerald-600">{bestScore}%</div>
                          <div className="text-[10px] text-emerald-600 font-medium">PASSED</div>
                        </div>
                      ) : maxReached ? (
                        <span className="text-xs text-red-500 font-medium">受験回数上限</span>
                      ) : (
                        <Link
                          href={`/dashboard/learning/${courseId}/test?testId=${test.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                        >
                          {count > 0 ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" /> 再受験
                            </>
                          ) : (
                            <>
                              受験する <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
