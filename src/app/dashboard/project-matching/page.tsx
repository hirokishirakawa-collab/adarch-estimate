import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProjectRequests, getAllProjectRequestsAdmin } from "@/lib/actions/project-matching";
import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  STATUS_CONFIG,
  formatBudget,
} from "@/lib/constants/project-matching";
import { Plus, Users, MapPin, Calendar, EyeOff } from "lucide-react";

export default async function ProjectMatchingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user.role ?? "USER") as import("@/types/roles").UserRole;
  const requests = role === "ADMIN"
    ? await getAllProjectRequestsAdmin()
    : await getProjectRequests();

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">案件マッチング</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            グループ企業間で案件を紹介し合えます
          </p>
        </div>
        <div className="flex gap-2">
          {role === "ADMIN" && (
            <Link
              href="/dashboard/project-matching/eligibility"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
            >
              応募資格一覧
            </Link>
          )}
          <Link
            href="/dashboard/project-matching/mine"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
          >
            自社の履歴
          </Link>
          <Link
            href="/dashboard/project-matching/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            案件を投稿
          </Link>
        </div>
      </div>

      {/* 案件リスト */}
      {requests.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">
            現在募集中の案件はありません
          </p>
          <Link
            href="/dashboard/project-matching/new"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            最初の案件を投稿する
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {requests.map((req) => {
            const catLabel =
              CATEGORY_OPTIONS.find((c) => c.value === req.category)?.label ??
              req.category;
            const freqLabel =
              FREQUENCY_OPTIONS.find((f) => f.value === req.frequency)?.label ??
              req.frequency;
            const statusCfg = STATUS_CONFIG[req.status];
            const appCount = req.applications.length;

            return (
              <Link
                key={req.id}
                href={`/dashboard/project-matching/${req.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusCfg.bgColor} ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                      {"isHidden" in req && req.isHidden && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-700">
                          <EyeOff className="w-2.5 h-2.5" />
                          非公開
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-violet-50 border border-violet-200 text-violet-700">
                        {catLabel}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-50 border border-zinc-200 text-zinc-600">
                        {freqLabel}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-900 truncate">
                      {req.title}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                      {req.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2.5 text-[11px] text-zinc-400">
                      <span>
                        {req.postedByCompany.name}（{req.postedByCompany.ownerName}）
                      </span>
                      {req.prefecture && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {req.prefecture}
                        </span>
                      )}
                      <span>予算: {formatBudget(req.budget)}</span>
                      {req.deadline && (
                        <span className="inline-flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(req.deadline).toLocaleDateString("ja-JP", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-center">
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-50 border border-zinc-200">
                      <Users className="w-3 h-3 text-zinc-400" />
                      <span className="text-xs font-medium text-zinc-600">
                        {appCount}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">応募</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
