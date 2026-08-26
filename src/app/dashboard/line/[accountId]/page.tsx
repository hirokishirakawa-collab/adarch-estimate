import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";
import { fmtAgo } from "@/lib/line/format";
import { FriendRows } from "@/components/line/friend-rows";

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
  searchParams: Promise<{ q?: string; tag?: string; all?: string; sort?: string; star?: string }>;
}) {
  const { accountId } = await params;
  const { q = "", tag = "", all, sort = "unread", star = "" } = await searchParams;
  const minStar = Math.max(0, Math.min(5, Number(star) || 0));
  const orderBy =
    sort === "score"
      ? [{ score: "desc" as const }, { lastInboundAt: { sort: "desc" as const, nulls: "last" as const } }]
      : sort === "rating"
      ? [{ rating: "desc" as const }, { lastInboundAt: { sort: "desc" as const, nulls: "last" as const } }]
      : sort === "followed"
        ? [{ followedAt: "desc" as const }]
        : sort === "recent"
          ? [{ lastInboundAt: { sort: "desc" as const, nulls: "last" as const } }]
          : [{ unreadCount: "desc" as const }, { lastInboundAt: { sort: "desc" as const, nulls: "last" as const } }, { followedAt: "desc" as const }];
  const { account } = await loadAccountPage(accountId);

  const friends = await db.lineFriend.findMany({
    where: {
      accountId,
      ...(all ? {} : { isFollowing: true }),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(minStar > 0 ? { rating: { gte: minStar } } : {}),
      ...(q ? { OR: [{ displayName: { contains: q, mode: "insensitive" } }, { note: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy,
    take: LIMIT,
    include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
  });
  const [usedTags, tagDefs, menus] = await Promise.all([
    db.lineFriend.findMany({ where: { accountId }, select: { tags: true } }),
    db.lineTag.findMany({ where: { accountId }, select: { name: true, color: true } }),
    db.lineRichMenu.findMany({ where: { accountId, lineRichMenuId: { not: null } }, select: { id: true, name: true }, orderBy: { priority: "asc" } }),
  ]);
  const menuName = new Map(menus.map((m) => [m.id, m.name]));
  const rows = friends.map((f) => ({
    id: f.id,
    displayName: f.displayName,
    pictureUrl: f.pictureUrl,
    tags: f.tags,
    note: f.note,
    isFollowing: f.isFollowing,
    unfollowedAgo: fmtAgo(f.unfollowedAt),
    unreadCount: f.unreadCount,
    activeEnrollments: f._count.enrollments,
    mutedAt: !!f.mutedAt,
    rating: f.rating,
    score: f.score,
    richMenuName: f.richMenuId ? (menuName.get(f.richMenuId) ?? null) : null,
    richMenuPinned: f.richMenuPinned,
    inboundAgo: fmtAgo(f.lastInboundAt),
    followedAgo: fmtAgo(f.followedAt),
  }));
  const colorOf = new Map(tagDefs.map((t) => [t.name, t.color]));
  const allTags = [...new Set([...tagDefs.map((t) => t.name), ...usedTags.flatMap((f) => f.tags)])].sort();
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
        <select name="star" defaultValue={String(minStar || "")} className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white">
          <option value="">★: すべて</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>★{n}以上</option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white">
          <option value="unread">並び: 未読→最新</option>
          <option value="rating">並び: ★が高い順</option>
          <option value="score">並び: スコアが高い順</option>
          <option value="recent">並び: 最終受信が新しい順</option>
          <option value="followed">並び: 追加が新しい順</option>
        </select>
        <label className="text-xs text-zinc-500 flex items-center gap-1">
          <input type="checkbox" name="all" value="1" defaultChecked={!!all} />
          ブロック/解除済も表示
        </label>
        <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-white">絞り込む</button>
        <span className="text-xs text-zinc-400 ml-auto">友だち {total}人{friends.length >= LIMIT ? `（先頭${LIMIT}件を表示）` : ""}</span>
      </form>

      {friends.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          該当する友だちはいません。
        </div>
      ) : (
        <FriendRows accountId={accountId} friends={rows} colors={Object.fromEntries(colorOf)} menus={menus} />
      )}
    </div>
  );
}
