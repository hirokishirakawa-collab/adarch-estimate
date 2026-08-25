import Link from "next/link";
import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";
import { fmtAgo } from "@/lib/line/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LIMIT = 200;

// ---------------------------------------------------------------
// 友だち一覧（検索・タグ絞り込み・未読順）
// ---------------------------------------------------------------
export default async function LineFriendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ q?: string; tag?: string; all?: string }>;
}) {
  const { accountId } = await params;
  const { q = "", tag = "", all } = await searchParams;
  const { account } = await loadAccountPage(accountId);

  const friends = await db.lineFriend.findMany({
    where: {
      accountId,
      ...(all ? {} : { isFollowing: true }),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(q ? { OR: [{ displayName: { contains: q, mode: "insensitive" } }, { note: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ unreadCount: "desc" }, { lastInboundAt: { sort: "desc", nulls: "last" } }, { followedAt: "desc" }],
    take: LIMIT,
    include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
  });
  const allTags = [...new Set((await db.lineFriend.findMany({ where: { accountId }, select: { tags: true } })).flatMap((f) => f.tags))].sort();
  const total = await db.lineFriend.count({ where: { accountId, isFollowing: true } });

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <AccountHeader account={account} />

      <form className="flex items-center gap-2 flex-wrap" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="名前・メモで検索"
          className="px-3 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white w-56 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />
        <select name="tag" defaultValue={tag} className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white">
          <option value="">タグ: すべて</option>
          {allTags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className="text-xs text-zinc-500 flex items-center gap-1">
          <input type="checkbox" name="all" value="1" defaultChecked={!!all} />
          ブロック済も表示
        </label>
        <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-white">絞り込む</button>
        <span className="text-xs text-zinc-400 ml-auto">友だち {total}人{friends.length >= LIMIT ? `（先頭${LIMIT}件を表示）` : ""}</span>
      </form>

      {friends.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          該当する友だちはいません。
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
          {friends.map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/line/${accountId}/chat/${f.id}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors"
            >
              {f.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.pictureUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-zinc-100" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-zinc-100" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn("text-sm truncate", f.unreadCount > 0 ? "font-bold text-zinc-900" : "text-zinc-800")}>
                    {f.displayName ?? "（名前未取得）"}
                  </p>
                  {!f.isFollowing && <span className="text-[10px] text-zinc-400 border border-zinc-200 rounded px-1">ブロック/解除</span>}
                  {f.unreadCount > 0 && (
                    <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5">{f.unreadCount}</span>
                  )}
                  {f._count.enrollments > 0 && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 rounded px-1">配信中</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {f.tags.map((t) => (
                    <span key={t} className="text-[10px] bg-zinc-100 text-zinc-600 rounded px-1.5">{t}</span>
                  ))}
                  {f.note && <span className="text-[11px] text-zinc-400 truncate">{f.note}</span>}
                </div>
              </div>
              <div className="text-right text-[11px] text-zinc-400 shrink-0">
                <p>受信 {fmtAgo(f.lastInboundAt)}</p>
                <p>追加 {fmtAgo(f.followedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
