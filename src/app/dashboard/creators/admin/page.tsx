import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/roles";
import { Paintbrush } from "lucide-react";
import Link from "next/link";
import { CreatorAdminActions } from "./admin-actions";

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function CreatorAdminPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const selectedId = params.id;

  // 全クリエイター取得（管理用なのでステータス問わず）
  const creators = await db.creator.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      skills: { include: { category: true } },
      ratings: { orderBy: { createdAt: "desc" }, take: 1 },
      ndaAgreement: true,
      _count: { select: { portfolios: true } },
    },
  });

  // 選択中のクリエイター詳細
  const selected = selectedId
    ? await db.creator.findUnique({
        where: { id: selectedId },
        include: {
          skills: { include: { category: true } },
          ratings: { orderBy: { createdAt: "desc" } },
          ndaAgreement: true,
          analysis: true,
        },
      })
    : null;

  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "アクティブ", cls: "bg-emerald-50 text-emerald-700" },
    BANNED: { label: "BAN", cls: "bg-red-50 text-red-700" },
    SHADOW_BANNED: {
      label: "シャドウBAN",
      cls: "bg-amber-50 text-amber-700",
    },
    INACTIVE: { label: "非アクティブ", cls: "bg-zinc-100 text-zinc-500" },
  };

  const REPEAT_LABEL: Record<string, string> = {
    EXCELLENT: "◎",
    GOOD: "○",
    FAIR: "△",
    POOR: "×",
  };

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
          <Paintbrush
            className="text-zinc-600"
            style={{ width: "1.125rem", height: "1.125rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            クリエイター管理
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            裏評価・BAN管理・面接ステータス（ADMIN専用）
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左: クリエイター一覧 */}
        <div className="lg:col-span-1 bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-500">
              全{creators.length}名
            </p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-zinc-100">
            {creators.map((c) => {
              const status = STATUS_LABEL[c.status] || STATUS_LABEL.ACTIVE;
              const latestRating = c.ratings[0];
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/creators/admin?id=${c.id}`}
                  className={`block px-4 py-3 hover:bg-zinc-50 transition-colors ${
                    selectedId === c.id ? "bg-indigo-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-zinc-900">
                      {c.name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>{c.prefecture}</span>
                    <span>スキル{c.skills.length}</span>
                    {latestRating && (
                      <span>
                        面接{latestRating.videoInterviewed ? "済" : "未"}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 右: 選択クリエイター詳細 */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-zinc-400 text-sm">
              左の一覧からクリエイターを選択してください
            </div>
          ) : (
            <div className="space-y-4">
              {/* 基本情報ヘッダー */}
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">
                      {selected.name}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {selected.prefecture}{selected.city ? ` ${selected.city}` : ""} |{" "}
                      {selected.email} |{" "}
                      {selected.entityType === "corporation" ? "法人" : "個人"}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/creators/${selected.id}`}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    公開プロフィール →
                  </Link>
                </div>

                {/* スキル一覧 */}
                <div className="flex flex-wrap gap-1.5">
                  {selected.skills.map((s) => (
                    <span
                      key={s.id}
                      className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs"
                    >
                      {s.category.name}（{
                        s.level === "EXPERT" ? "エキスパート" :
                        s.level === "ADVANCED" ? "上級" :
                        s.level === "INTERMEDIATE" ? "中級" : "初級"
                      }）
                    </span>
                  ))}
                </div>
              </div>

              {/* BAN・ステータス管理 */}
              <CreatorAdminActions
                creatorId={selected.id}
                currentStatus={selected.status}
                userId={session?.user?.id || ""}
                latestRating={
                  selected.ratings[0]
                    ? {
                        personality: selected.ratings[0].personality,
                        actualSkill: selected.ratings[0].actualSkill,
                        responseSpeed: selected.ratings[0].responseSpeed,
                        deadlineCompliance: selected.ratings[0].deadlineCompliance,
                        repeatIntention: selected.ratings[0].repeatIntention,
                        videoInterviewed: selected.ratings[0].videoInterviewed,
                        interviewedBy: selected.ratings[0].interviewedBy || "",
                        notes: selected.ratings[0].notes || "",
                      }
                    : null
                }
              />

              {/* 評価履歴 */}
              {selected.ratings.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-xl p-5">
                  <h3 className="font-bold text-sm text-zinc-900 mb-3">
                    評価履歴
                  </h3>
                  <div className="space-y-3">
                    {selected.ratings.map((r) => (
                      <div
                        key={r.id}
                        className="border border-zinc-100 rounded-lg p-3 text-sm"
                      >
                        <div className="grid grid-cols-5 gap-2 mb-2">
                          <div className="text-center">
                            <p className="text-[10px] text-zinc-400">人柄</p>
                            <p className="font-bold text-zinc-900">
                              {r.personality}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-zinc-400">
                              スキル
                            </p>
                            <p className="font-bold text-zinc-900">
                              {r.actualSkill}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-zinc-400">
                              レスポンス
                            </p>
                            <p className="font-bold text-zinc-900">
                              {r.responseSpeed}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-zinc-400">納期</p>
                            <p className="font-bold text-zinc-900">
                              {r.deadlineCompliance}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-zinc-400">
                              リピート
                            </p>
                            <p className="font-bold text-zinc-900">
                              {REPEAT_LABEL[r.repeatIntention]}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                          <span>
                            面接: {r.videoInterviewed ? `実施済み${r.interviewedBy ? `（${r.interviewedBy}）` : ""}` : "未実施"}
                          </span>
                          <span>
                            {new Date(r.createdAt).toLocaleDateString("ja-JP")}
                          </span>
                        </div>
                        {r.notes && (
                          <p className="mt-2 text-xs text-zinc-500 bg-zinc-50 rounded p-2">
                            {r.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
