import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GraduationCap, Plus, ChevronRight, BookOpen, ClipboardCheck, Users } from "lucide-react";
import { CreateCourseForm } from "./create-course-form";
import { CoursePublishToggle } from "./course-publish-toggle";

export default async function AdminLearningPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await db.user.findUnique({ where: { email: session.user.email! } });
  if (!user || user.role !== "ADMIN") redirect("/dashboard/learning");

  const courses = await db.learningCourse.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    include: {
      _count: {
        select: { lessons: true, tests: true, enrollments: true },
      },
    },
  });

  const categoryConfig: Record<string, { label: string; bg: string; text: string }> = {
    onboard: { label: "オンボード", bg: "bg-emerald-50", text: "text-emerald-700" },
    media: { label: "媒体テスト", bg: "bg-blue-50", text: "text-blue-700" },
    advanced: { label: "上級", bg: "bg-violet-50", text: "text-violet-700" },
  };

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
            <GraduationCap className="text-zinc-600 w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">ラーニング管理</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              コース・教材・テストを管理します（ADMIN 専用）
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/admin/learning/progress"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          受講状況
        </Link>
      </div>

      {/* 新規作成 */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-bold text-zinc-800">新しいコースを作成</h3>
        </div>
        <CreateCourseForm />
      </div>

      {/* コース一覧 */}
      <div className="space-y-2">
        {courses.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <GraduationCap className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-500">コースがまだ登録されていません</p>
          </div>
        ) : (
          courses.map((c) => {
            const cat = categoryConfig[c.category] ?? categoryConfig.media;
            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 transition-colors"
              >
                <div className="p-4 flex items-center gap-4">
                  <Link
                    href={`/dashboard/admin/learning/${c.id}`}
                    className="flex-1 min-w-0 flex items-center gap-4 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-50 border flex items-center justify-center">
                      <span className="text-xs font-bold text-zinc-400">#{c.sortOrder}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${cat.bg} ${cat.text}`}>
                          {cat.label}
                        </span>
                        {!c.published && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-zinc-100 text-zinc-600">
                            非公開
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-zinc-900 group-hover:text-blue-700 transition-colors truncate">
                        {c.title}
                      </h3>
                      {c.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{c.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <BookOpen className="w-3 h-3" /> {c._count.lessons}教材
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <ClipboardCheck className="w-3 h-3" /> {c._count.tests}テスト
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <Users className="w-3 h-3" /> {c._count.enrollments}受講者
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <CoursePublishToggle id={c.id} published={c.published} />
                    <Link
                      href={`/dashboard/admin/learning/${c.id}`}
                      className="text-zinc-400 hover:text-blue-600 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
