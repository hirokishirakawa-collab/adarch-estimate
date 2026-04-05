import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { GraduationCap, BookOpen, CheckCircle, Trophy, ChevronRight, Play, FileText, ClipboardCheck } from "lucide-react";

export default async function LearningPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { email: session.user.email! },
  });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";

  const courses = await db.learningCourse.findMany({
    where: isAdmin ? {} : { published: true },
    orderBy: { sortOrder: "asc" },
    include: {
      lessons: { select: { id: true, type: true } },
      tests: { select: { id: true } },
      enrollments: {
        where: { userId: user.id },
        select: { status: true },
      },
    },
  });

  // ユーザーの完了レッスンID
  const completedProgress = await db.learningProgress.findMany({
    where: { userId: user.id, completed: true },
    select: { lessonId: true },
  });
  const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));

  // ユーザーの合格テストID
  const passedAttempts = await db.learningAttempt.findMany({
    where: { userId: user.id, passed: true },
    select: { testId: true },
  });
  const passedTestIds = new Set(passedAttempts.map((a) => a.testId));

  // 集計
  const totalCourses = courses.length;
  const completedCourses = courses.filter((c) => c.enrollments[0]?.status === "completed").length;
  const totalTests = courses.reduce((s, c) => s + c.tests.length, 0);
  const passedTests = courses.reduce((s, c) => s + c.tests.filter((t) => passedTestIds.has(t.id)).length, 0);

  const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
    onboard: { label: "オンボード", color: "text-emerald-700", bg: "bg-emerald-50" },
    media: { label: "媒体テスト", color: "text-blue-700", bg: "bg-blue-50" },
    advanced: { label: "上級", color: "text-violet-700", bg: "bg-violet-50" },
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">ラーニング</h1>
            <p className="text-xs text-zinc-500">教材を学習してテストに合格すると、媒体の販売権限が付与されます</p>
          </div>
        </div>
        <Link
          href="/dashboard/learning/credentials"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" />
          取得資格
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-zinc-400" />
            <span className="text-[11px] font-medium text-zinc-500">コース</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{totalCourses}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-[11px] font-medium text-zinc-500">修了済み</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{completedCourses}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="w-4 h-4 text-blue-500" />
            <span className="text-[11px] font-medium text-zinc-500">テスト合格</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{passedTests}<span className="text-sm font-normal text-zinc-400">/{totalTests}</span></p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] font-medium text-zinc-500">達成率</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">
            {totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}
            <span className="text-sm font-normal text-zinc-400">%</span>
          </p>
        </div>
      </div>

      {/* Course Cards */}
      <div className="space-y-3">
        {courses.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <GraduationCap className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-500">コースはまだ登録されていません</p>
          </div>
        ) : (
          courses.map((course) => {
            const enrollment = course.enrollments[0];
            const isCompleted = enrollment?.status === "completed";
            const cat = categoryConfig[course.category] ?? categoryConfig.media;

            const lessonCount = course.lessons.length;
            const completedCount = course.lessons.filter((l) => completedLessonIds.has(l.id)).length;
            const testCount = course.tests.length;
            const passedCount = course.tests.filter((t) => passedTestIds.has(t.id)).length;
            const totalSteps = lessonCount + testCount;
            const doneSteps = completedCount + passedCount;
            const pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

            const hasVideo = course.lessons.some((l) => l.type === "video");

            return (
              <Link
                key={course.id}
                href={`/dashboard/learning/${course.id}`}
                className="group block bg-white rounded-xl border hover:shadow-md transition-all duration-200"
              >
                <div className="p-5 flex items-center gap-5">
                  {/* Progress Ring */}
                  <div className="relative flex-shrink-0">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#f4f4f5" strokeWidth="4" />
                      <circle
                        cx="28" cy="28" r="24" fill="none"
                        stroke={isCompleted ? "#10b981" : pct > 0 ? "#3b82f6" : "#e4e4e7"}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${(pct / 100) * 150.8} 150.8`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <span className="text-xs font-bold text-zinc-600">{pct}%</span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${cat.bg} ${cat.color}`}>
                        {cat.label}
                      </span>
                      {isCompleted && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700">
                          合格済み
                        </span>
                      )}
                    </div>
                    <h3 className="text-[15px] font-bold text-zinc-900 group-hover:text-blue-700 transition-colors truncate">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{course.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {hasVideo && (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <Play className="w-3 h-3" /> 動画あり
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                        <FileText className="w-3 h-3" /> {lessonCount}教材
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                        <ClipboardCheck className="w-3 h-3" /> {testCount}テスト
                      </span>
                    </div>
                    {/* Progress bar */}
                    {totalSteps > 0 && (
                      <div className="mt-2.5 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isCompleted ? "bg-emerald-500" : "bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
