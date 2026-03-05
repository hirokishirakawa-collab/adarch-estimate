import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getActiveHighlights } from "@/lib/actions/collaboration-highlight";

export default async function AllHighlightsPage() {
  const highlights = await getActiveHighlights();

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/group-profiles"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          メンバー紹介
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
          <Sparkles className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">連携案件ハイライト</h2>
          <p className="text-xs text-zinc-500 mt-0.5">グループ代表同士が連携して進めている案件</p>
        </div>
      </div>

      {highlights.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {highlights.map((h) => (
            <div
              key={h.id}
              className="relative overflow-hidden rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-white to-blue-50/60 p-4 shadow-sm"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-violet-200/15 to-transparent rounded-bl-full pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-1.5">
                  {h.emoji && <span className="text-lg">{h.emoji}</span>}
                  <span className="text-sm font-bold text-violet-900">{h.title}</span>
                </div>
                <p className="text-xs text-violet-700/70 mb-3 leading-relaxed line-clamp-2">
                  {h.description}
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  {h.members.map((m) => (
                    <Link
                      key={m.groupCompany.id}
                      href={`/dashboard/group-profiles/${m.groupCompany.id}`}
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium bg-white/80 text-violet-700 rounded-full border border-violet-200/50 hover:bg-white hover:border-violet-300 transition-colors"
                    >
                      {m.groupCompany.emoji && <span>{m.groupCompany.emoji}</span>}
                      {m.groupCompany.ownerName}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-sm text-zinc-400">
          連携案件はまだありません
        </div>
      )}
    </div>
  );
}
