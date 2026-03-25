import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { GraduationCap, BookOpen, CheckCircle, Clock, Plus } from "lucide-react";
import type { UserRole } from "@/types/roles";

export default async function LearningPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { email: session.user.email! },
  });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";

  // コース一覧（公開済み or ADMIN）
  const courses = await db.learningCourse.findMany({
    where: isAdmin ? {} : { published: true },
    orderBy: { sortOrder: "asc" },
    include: {
      lessons: { select: { id: true } },
      tests: { select: { id: true } },
      enrollments: {
        where: { userId: user.id },
        select: { status: true },
      },
    },
  });

  // ユーザーの合格テスト数
  const passedTests = await db.learningAttempt.count({
    where: { userId: user.id, passed: true },
  });

  // ユーザーの完了レッスン数
  const completedLessons = await db.learningProgress.count({
    where: { userId: user.id, completed: true },
  });

  const totalLessons = courses.reduce((sum, c) => sum + c.lessons.length, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">ラーニング</h1>
            <p className="text-xs text-zinc-500">オンボード教材・媒体取扱テスト</p>
          </div>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/learning/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            コース管理
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <BookOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{completedLessons}/{totalLessons}</p>
              <p className="text-sm text-zinc-500">教材完了</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{passedTests}</p>
              <p className="text-sm text-zinc-500">合格テスト</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-50 rounded-lg">
              <Clock className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{courses.length}</p>
              <p className="text-sm text-zinc-500">コース数</p>
            </div>
          </div>
        </div>
      </div>

      {/* Course List */}
      <div className="space-y-4">
        {courses.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <GraduationCap className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-500">コースはまだ登録されていません</p>
          </div>
        ) : (
          courses.map((course) => {
            const enrollment = course.enrollments[0];
            const isCompleted = enrollment?.status === "completed";
            const isFrozen = enrollment?.status === "frozen";
            const categoryLabel =
              course.category === "onboard" ? "オンボード" :
              course.category === "media" ? "媒体テスト" : "上級";
            const categoryColor =
              course.category === "onboard" ? "bg-emerald-50 text-emerald-700" :
              course.category === "media" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700";

            return (
              <Link
                key={course.id}
                href={`/dashboard/learning/${course.id}`}
                className="block bg-white rounded-xl border hover:border-emerald-300 transition-colors p-6 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${categoryColor}`}>
                        {categoryLabel}
                      </span>
                      {isCompleted && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-50 text-green-700">
                          合格済み
                        </span>
                      )}
                      {isFrozen && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-50 text-red-700">
                          凍結中
                        </span>
                      )}
                      {!isAdmin && !course.published && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-zinc-100 text-zinc-500">
                          非公開
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{course.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-zinc-400">
                      <span>{course.lessons.length} 教材</span>
                      <span>{course.tests.length} テスト</span>
                    </div>
                  </div>
                  <div className="text-zinc-300 group-hover:text-emerald-500 transition-colors ml-4">
                    →
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
