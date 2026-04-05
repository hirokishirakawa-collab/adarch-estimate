import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChevronLeft, Award, Lock, Trophy } from "lucide-react";

export default async function CredentialsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await db.user.findUnique({ where: { email: session.user.email! } });
  if (!user) redirect("/login");

  const courses = await db.learningCourse.findMany({
    where: { published: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    include: { tests: { select: { id: true } } },
  });

  // 合格済みテストID
  const attempts = await db.learningAttempt.findMany({
    where: { userId: user.id, passed: true },
    select: { testId: true, score: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const passedSet = new Set(attempts.map((a) => a.testId));

  // コースごとの最新合格スコアと取得日
  const bestByTest = new Map<string, { score: number; date: Date }>();
  for (const a of attempts) {
    const prev = bestByTest.get(a.testId);
    if (!prev || a.score > prev.score) bestByTest.set(a.testId, { score: a.score, date: a.createdAt });
  }

  const earned = courses.filter(
    (c) => c.tests.length > 0 && c.tests.every((t) => passedSet.has(t.id))
  );
  const locked = courses.filter(
    (c) => c.tests.length > 0 && !c.tests.every((t) => passedSet.has(t.id))
  );

  const categoryConfig: Record<string, { label: string; grad: string; ring: string }> = {
    onboard: { label: "オンボード", grad: "from-emerald-400 to-emerald-600", ring: "ring-emerald-200" },
    media: { label: "媒体", grad: "from-blue-400 to-blue-600", ring: "ring-blue-200" },
    advanced: { label: "上級", grad: "from-violet-400 to-violet-600", ring: "ring-violet-200" },
  };

  function fmtDate(d: Date) {
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }

  function courseBestScore(course: (typeof courses)[number]) {
    const scores = course.tests.map((t) => bestByTest.get(t.id)?.score ?? 0);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  function courseEarnedDate(course: (typeof courses)[number]) {
    const dates = course.tests.map((t) => bestByTest.get(t.id)?.date).filter(Boolean) as Date[];
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link
        href="/dashboard/learning"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        ラーニング
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-sm">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">取得資格</h1>
          <p className="text-xs text-zinc-500">テストに合格した媒体・コースの証明書</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold text-amber-600">{earned.length}</div>
          <div className="text-[10px] text-zinc-400 font-bold">EARNED</div>
        </div>
      </div>

      {/* 取得済みバッジ */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          取得済み ({earned.length})
        </h2>
        {earned.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed p-8 text-center">
            <Award className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">まだ取得している資格はありません</p>
            <p className="text-[11px] text-zinc-400 mt-1">テストに合格するとここに表示されます</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {earned.map((c) => {
              const cat = categoryConfig[c.category] ?? categoryConfig.media;
              const avgScore = courseBestScore(c);
              const earnedDate = courseEarnedDate(c);
              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-2xl border p-5 relative overflow-hidden ring-4 ${cat.ring}/40 hover:shadow-md transition-all`}
                >
                  {/* 装飾グラデーション */}
                  <div
                    className={`absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br ${cat.grad} rounded-full opacity-10`}
                  />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.grad} flex items-center justify-center shadow-sm`}
                      >
                        <Award className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-zinc-900">{avgScore}%</div>
                        <div className="text-[9px] text-zinc-400 font-bold">SCORE</div>
                      </div>
                    </div>
                    <div className="mb-1">
                      <span className="text-[10px] font-bold text-zinc-500">{cat.label}</span>
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 leading-snug">{c.title}</h3>
                    {earnedDate && (
                      <p className="text-[10px] text-zinc-400 mt-2">取得日: {fmtDate(earnedDate)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 未取得 */}
      {locked.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-zinc-400" />
            未取得 ({locked.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {locked.map((c) => {
              const cat = categoryConfig[c.category] ?? categoryConfig.media;
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/learning/${c.id}`}
                  className="bg-white rounded-2xl border p-5 hover:shadow-md hover:border-zinc-300 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-zinc-400" />
                    </div>
                  </div>
                  <div className="mb-1">
                    <span className="text-[10px] font-bold text-zinc-500">{cat.label}</span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-700 leading-snug group-hover:text-blue-700 transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-2">挑戦する →</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
