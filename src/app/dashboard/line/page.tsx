import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, Users, Radio, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { manageableWhere } from "@/lib/line/access";
import { fmtAgo } from "@/lib/line/format";
import { AccountForm } from "@/components/line/account-form";

export const metadata = { title: "LINE公式アカウント" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------
// /dashboard/line — 自分が操作できるアカウント一覧
//   本部: 本部アカウントはフル操作／拠点アカウントは接続状況と件数だけ
// ---------------------------------------------------------------
export default async function LineHomePage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  const mine = await db.lineAccount.findMany({
    where: manageableWhere(info),
    orderBy: { createdAt: "asc" },
    include: {
      branch: { select: { name: true } },
      _count: { select: { friends: { where: { isFollowing: true } }, scenarios: true } },
    },
  });
  const unreadByAccount = await db.lineFriend.groupBy({
    by: ["accountId"],
    where: { accountId: { in: mine.map((a) => a.id) }, unreadCount: { gt: 0 } },
    _count: { _all: true },
  });
  const unread = new Map(unreadByAccount.map((u) => [u.accountId, u._count._all]));

  // 本部だけ：拠点アカウントの件数（会話・名前は出さない）
  const branchAccounts =
    info.role === "ADMIN"
      ? await db.lineAccount.findMany({
          where: { branchId: { not: null } },
          orderBy: { createdAt: "asc" },
          include: {
            branch: { select: { name: true } },
            _count: { select: { friends: { where: { isFollowing: true } }, scenarios: true, broadcasts: true } },
          },
        })
      : [];

  const ownerLabel =
    info.role === "ADMIN"
      ? "本部"
      : ((await db.branch.findUnique({ where: { id: info.branchId ?? "" }, select: { name: true } }))?.name ?? "自拠点");

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
            <MessageCircle className="text-emerald-700" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">LINE公式アカウント</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              友だち管理・1:1チャット・ステップ配信・一斉配信。拠点ごとに1つ接続できます。
            </p>
          </div>
        </div>
        <AccountForm ownerLabel={ownerLabel} collapsible />
      </div>

      {mine.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-8 text-center">
          <p className="text-sm text-zinc-600">まだ接続されていません。</p>
          <p className="text-xs text-zinc-400 mt-1">
            LINE公式アカウント（無料）を作り、LINE Developers で Messaging API を有効化して、上のボタンから3つの値を貼るだけです。
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mine.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/line/${a.id}`}
              className="bg-white rounded-xl border border-zinc-200 p-4 hover:border-emerald-300 transition-colors block"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-zinc-900">{a.name}</p>
                {(unread.get(a.id) ?? 0) > 0 && (
                  <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">
                    未読 {unread.get(a.id)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {a.branch?.name ?? "本部"}
                {a.basicId ? ` ・ ${a.basicId}` : ""}
              </p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Stat icon={Users} label="友だち" value={String(a._count.friends)} />
                <Stat icon={Radio} label="シナリオ" value={String(a._count.scenarios)} />
                <Stat icon={Clock} label="最終受信" value={fmtAgo(a.webhookLastAt)} />
              </div>
              {!a.webhookLastAt && (
                <p className="text-[11px] text-amber-700 mt-2">Webhook未受信＝LINE Developers側の設定を確認してください（設定タブに手順）</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {info.role === "ADMIN" && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-zinc-500">拠点のLINE接続状況（件数のみ・会話は見ません）</h3>
          {branchAccounts.length === 0 ? (
            <p className="text-xs text-zinc-400">拠点の接続はまだありません。</p>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">拠点</th>
                    <th className="text-left px-3 py-2 font-medium">アカウント</th>
                    <th className="text-right px-3 py-2 font-medium">友だち</th>
                    <th className="text-right px-3 py-2 font-medium">シナリオ</th>
                    <th className="text-right px-3 py-2 font-medium">一斉配信</th>
                    <th className="text-right px-3 py-2 font-medium">最終受信</th>
                  </tr>
                </thead>
                <tbody>
                  {branchAccounts.map((a) => (
                    <tr key={a.id} className="border-t border-zinc-100">
                      <td className="px-3 py-2 text-zinc-800">{a.branch?.name}</td>
                      <td className="px-3 py-2 text-zinc-800">{a.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{a._count.friends}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{a._count.scenarios}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{a._count.broadcasts}</td>
                      <td className="px-3 py-2 text-right text-zinc-500">
                        {fmtAgo(a.webhookLastAt)}
                        {a.webhookError && (!a.webhookLastAt || (a.webhookErrorAt && a.webhookErrorAt > a.webhookLastAt)) && (
                          <span className="block text-[10px] text-red-600">署名不一致</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-zinc-50 rounded-lg px-2 py-1.5">
      <p className="text-[10px] text-zinc-400 flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <p className="text-sm font-bold text-zinc-900 tabular-nums">{value}</p>
    </div>
  );
}
