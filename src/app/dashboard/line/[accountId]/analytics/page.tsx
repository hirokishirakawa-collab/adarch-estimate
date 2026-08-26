import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------
// 流入経路分析：経路（セミナー枠・常設枠・不明）ごとに
// 友だち数 → ブロック率 → クリック → 回答 → 予約 → 成約 を人数で並べる
// ---------------------------------------------------------------
type Row = { source: string; friends: number; blocked: number; clicked: number; formed: number; booked: number; converted: number; score: number };

export default async function LineAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { accountId } = await params;
  const { days: daysParam = "90" } = await searchParams;
  const { account } = await loadAccountPage(accountId);
  const days = [30, 90, 365, 0].includes(Number(daysParam)) ? Number(daysParam) : 90;
  const since = days > 0 ? new Date(Date.now() - days * 86_400_000) : null;
  const conversionTag = account.conversionTag?.trim() || "成約";

  const friends = await db.lineFriend.findMany({
    where: { accountId, ...(since ? { followedAt: { gte: since } } : {}) },
    select: { id: true, source: true, isFollowing: true, score: true },
  });
  const ids = friends.map((f) => f.id);
  const events = ids.length
    ? await db.lineEvent.findMany({
        where: { accountId, friendId: { in: ids }, type: { in: ["click", "form", "booking", "tag"] } },
        select: { friendId: true, type: true, refId: true },
      })
    : [];
  const did = new Map<string, Set<string>>(); // friendId -> set of "click"/"form"/"booking"/"converted"
  for (const e of events) {
    const key = e.type === "tag" ? (e.refId === conversionTag ? "converted" : null) : e.type;
    if (!key) continue;
    if (!did.has(e.friendId)) did.set(e.friendId, new Set());
    did.get(e.friendId)!.add(key);
  }

  const bySource = new Map<string, Row>();
  const add = (src: string, f: (typeof friends)[number]) => {
    const r = bySource.get(src) ?? { source: src, friends: 0, blocked: 0, clicked: 0, formed: 0, booked: 0, converted: 0, score: 0 };
    r.friends++;
    if (!f.isFollowing) r.blocked++;
    const d = did.get(f.id);
    if (d?.has("click")) r.clicked++;
    if (d?.has("form")) r.formed++;
    if (d?.has("booking")) r.booked++;
    if (d?.has("converted")) r.converted++;
    r.score += f.score;
    bySource.set(src, r);
  };
  for (const f of friends) add(f.source ?? "（経路不明）", f);
  const rows = [...bySource.values()].sort((a, b) => b.friends - a.friends);
  const total = rows.reduce(
    (t, r) => ({ ...t, friends: t.friends + r.friends, blocked: t.blocked + r.blocked, clicked: t.clicked + r.clicked, formed: t.formed + r.formed, booked: t.booked + r.booked, converted: t.converted + r.converted, score: t.score + r.score }),
    { source: "合計", friends: 0, blocked: 0, clicked: 0, formed: 0, booked: 0, converted: 0, score: 0 } as Row,
  );
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

  const entryPoints = await db.lineEntryPoint.findMany({ where: { accountId }, select: { name: true, followCount: true, startsAt: true, isActive: true }, orderBy: { createdAt: "desc" } });

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <AccountHeader account={account} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-zinc-500">
          経路＝友だち追加時に判定した「セミナー・流入枠」（時間帯またはボタン選択）。数字は人数、率は友だち数に対する割合。成約はタグ「{conversionTag}」。
        </p>
        <form method="get" className="flex items-center gap-1">
          {[30, 90, 365, 0].map((d) => (
            <button key={d} name="days" value={d} className={`px-2.5 py-1 text-xs rounded-lg border ${days === d ? "bg-zinc-800 text-white border-zinc-800" : "border-zinc-200 bg-white text-zinc-600"}`}>
              {d === 0 ? "全期間" : `${d}日`}
            </button>
          ))}
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">この期間に追加された友だちはいません。</div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">経路</th>
                <th className="text-right px-3 py-2 font-medium">友だち</th>
                <th className="text-right px-3 py-2 font-medium">ブロック/解除</th>
                <th className="text-right px-3 py-2 font-medium">クリック</th>
                <th className="text-right px-3 py-2 font-medium">回答</th>
                <th className="text-right px-3 py-2 font-medium">予約</th>
                <th className="text-right px-3 py-2 font-medium">成約</th>
                <th className="text-right px-3 py-2 font-medium" title="行動スコアの平均">平均pt</th>
              </tr>
            </thead>
            <tbody>
              {[...rows, total].map((r, i) => (
                <tr key={r.source} className={`border-t border-zinc-100 ${i === rows.length ? "bg-zinc-50 font-bold" : ""}`}>
                  <td className="px-3 py-2 text-zinc-800">{r.source}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.friends}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-700">{r.blocked}（{pct(r.blocked, r.friends)}）</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.clicked}（{pct(r.clicked, r.friends)}）</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.formed}（{pct(r.formed, r.friends)}）</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.booked}（{pct(r.booked, r.friends)}）</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{r.converted}（{pct(r.converted, r.friends)}）</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.friends > 0 ? Math.round(r.score / r.friends) : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="space-y-2">
        <p className="text-xs font-bold text-zinc-500">登録済みの経路（セミナー・流入枠）</p>
        {entryPoints.length === 0 ? (
          <p className="text-xs text-zinc-400">まだ枠はありません。「セミナー・流入枠」タブで登録すると、ここに経路として並びます。常設の経路（LP・広告・名刺）は日時を空にして登録してください。</p>
        ) : (
          <ul className="text-xs text-zinc-700 space-y-1">
            {entryPoints.map((ep) => (
              <li key={ep.name}>
                {ep.name} — 紐づいた追加 {ep.followCount}人{!ep.isActive ? "（停止）" : ""}{ep.startsAt ? "" : "（常設）"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
