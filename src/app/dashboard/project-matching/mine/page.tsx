import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMyProjectRequests } from "@/lib/actions/project-matching";
import {
  CATEGORY_OPTIONS,
  STATUS_CONFIG,
} from "@/lib/constants/project-matching";

export default async function MyProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { posted, applied } = await getMyProjectRequests();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/dashboard/project-matching"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors mb-3"
        >
          <ArrowLeft className="w-3 h-3" />
          案件一覧に戻る
        </Link>
        <h1 className="text-lg font-bold text-zinc-900">自社の履歴</h1>
      </div>

      {/* 投稿した案件 */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 mb-2">
          投稿した案件（{posted.length}件）
        </h2>
        {posted.length === 0 ? (
          <p className="text-xs text-zinc-400">投稿した案件はありません</p>
        ) : (
          <div className="space-y-2">
            {posted.map((req) => {
              const statusCfg = STATUS_CONFIG[req.status];
              const catLabel =
                CATEGORY_OPTIONS.find((c) => c.value === req.category)?.label ??
                req.category;
              return (
                <Link
                  key={req.id}
                  href={`/dashboard/project-matching/${req.id}`}
                  className="block rounded-md border border-zinc-200 bg-white p-3 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusCfg.bgColor} ${statusCfg.color}`}
                    >
                      {statusCfg.label}
                    </span>
                    <span className="text-[10px] text-violet-600">
                      {catLabel}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      応募 {req.applications.length}件
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-900">
                    {req.title}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 応募した案件 */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 mb-2">
          応募した案件（{applied.length}件）
        </h2>
        {applied.length === 0 ? (
          <p className="text-xs text-zinc-400">応募した案件はありません</p>
        ) : (
          <div className="space-y-2">
            {applied.map((app) => {
              const req = app.projectRequest;
              const statusCfg = STATUS_CONFIG[req.status];
              const isMatched = req.status === "MATCHED" && req.matchedCompanyId === app.applicantCompanyId;
              return (
                <Link
                  key={app.id}
                  href={`/dashboard/project-matching/${req.id}`}
                  className="block rounded-md border border-zinc-200 bg-white p-3 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusCfg.bgColor} ${statusCfg.color}`}
                    >
                      {statusCfg.label}
                    </span>
                    {isMatched && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
                        選ばれました
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400">
                      {req.postedByCompany.name}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-900">
                    {req.title}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
