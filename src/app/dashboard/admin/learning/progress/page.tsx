import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChevronLeft, CheckCircle, Circle, Users, ShieldCheck } from "lucide-react";

export default async function AdminLearningProgressPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await db.user.findUnique({ where: { email: session.user.email! } });
  if (!user || user.role !== "ADMIN") redirect("/dashboard/learning");

  const [courses, users, attempts] = await Promise.all([
    db.learningCourse.findMany({
      where: { published: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      include: {
        tests: { select: { id: true } },
      },
    }),
    db.user.findMany({
      where: { role: { in: ["USER", "MANAGER"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, learningExempt: true, isActive: true },
    }),
    db.learningAttempt.findMany({
      where: { passed: true },
      select: { userId: true, testId: true },
    }),
  ]);

  // userId -> Set<testId> の合格マップ
  const passedByUser = new Map<string, Set<string>>();
  for (const a of attempts) {
    if (!passedByUser.has(a.userId)) passedByUser.set(a.userId, new Set());
    passedByUser.get(a.userId)!.add(a.testId);
  }

  // コースの全テストに合格していれば「修了」
  function isCompleted(userId: string, course: (typeof courses)[number]) {
    if (course.tests.length === 0) return false;
    const passed = passedByUser.get(userId) ?? new Set();
    return course.tests.every((t) => passed.has(t.id));
  }

  // 免除ユーザーID
  const exemptIds = new Set(users.filter((u) => u.learningExempt).map((u) => u.id));

  const categoryConfig: Record<string, { label: string; color: string }> = {
    onboard: { label: "オンボード", color: "bg-emerald-50 text-emerald-700" },
    media: { label: "媒体", color: "bg-blue-50 text-blue-700" },
    advanced: { label: "上級", color: "bg-violet-50 text-violet-700" },
  };

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto w-full">
      <Link
        href="/dashboard/admin/learning"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        ラーニング管理
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
          <Users className="text-zinc-600 w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">受講状況ダッシュボード</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            メンバー別にどのコースを修了済みか一覧できます
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 sticky left-0 bg-zinc-50 z-10 min-w-[200px]">
                メンバー
              </th>
              {courses.map((c) => {
                const cat = categoryConfig[c.category] ?? categoryConfig.media;
                return (
                  <th
                    key={c.id}
                    className="px-3 py-3 text-left text-xs font-medium text-zinc-700 min-w-[140px]"
                  >
                    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ${cat.color} mb-1`}>
                      {cat.label}
                    </span>
                    <div className="truncate max-w-[140px]">{c.title}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isExempt = exemptIds.has(u.id);
              const completedCount = courses.filter((c) => isCompleted(u.id, c)).length;
              return (
                <tr key={u.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-zinc-900 truncate">{u.name ?? "（無名）"}</span>
                          {isExempt && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-50 text-amber-700 border border-amber-200"
                              title="既存加盟者として資格免除"
                            >
                              <ShieldCheck className="w-2.5 h-2.5" />
                              免除
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">{u.email}</div>
                      </div>
                      <span className="ml-auto text-[10px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                        {completedCount}/{courses.length}
                      </span>
                    </div>
                  </td>
                  {courses.map((c) => {
                    const done = isCompleted(u.id, c);
                    return (
                      <td key={c.id} className="px-3 py-3">
                        {isExempt ? (
                          <ShieldCheck className="w-5 h-5 text-amber-500" />
                        ) : done ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-zinc-200" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={courses.length + 1} className="px-4 py-8 text-center text-zinc-400 text-sm">
                  メンバーがいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
