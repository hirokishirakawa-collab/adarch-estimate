import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getAllHighlights } from "@/lib/actions/collaboration-highlight";
import { getGroupCompanyOptions } from "@/lib/actions/admin";
import { adminCreateHighlight } from "@/lib/actions/collaboration-highlight";
import { HighlightForm } from "@/components/group-profiles/highlight-form";
import { Sparkles, ArrowLeft, Pencil } from "lucide-react";
import type { UserRole } from "@/types/roles";

export default async function HighlightsAdminPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const [highlights, companies] = await Promise.all([
    getAllHighlights(),
    getGroupCompanyOptions(),
  ]);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/group-profiles"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            メンバー紹介
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
          <Sparkles className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">連携案件ハイライト</h2>
          <p className="text-xs text-zinc-500 mt-0.5">代表同士の連携案件を管理</p>
        </div>
      </div>

      {/* 既存一覧 */}
      {highlights.length > 0 && (
        <div className="mb-8 space-y-3">
          {highlights.map((h) => (
            <div
              key={h.id}
              className={`bg-white border rounded-xl p-4 flex items-center justify-between ${
                h.isActive ? "border-zinc-200" : "border-zinc-100 opacity-60"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {h.emoji && <span className="text-lg">{h.emoji}</span>}
                  <span className="text-sm font-bold text-zinc-900">{h.title}</span>
                  {!h.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded-full">
                      非表示
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{h.description}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {h.members.map((m) => (
                    <span
                      key={m.groupCompany.id}
                      className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-violet-50 text-violet-700 rounded-full"
                    >
                      {m.groupCompany.ownerName}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href={`/dashboard/group-profiles/highlights/${h.id}/edit`}
                className="ml-4 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-md hover:bg-zinc-100 transition-colors flex-shrink-0"
              >
                <Pencil className="w-3 h-3" />
                編集
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* 新規作成フォーム */}
      <div className="border-t border-zinc-200 pt-8">
        <HighlightForm companies={companies} action={adminCreateHighlight} />
      </div>
    </div>
  );
}
