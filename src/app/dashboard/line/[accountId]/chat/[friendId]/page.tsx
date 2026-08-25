import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";
import { ChatSendBox, FriendMetaForm, StartScenarioSelect } from "@/components/line/chat-box";
import { MuteButton, CustomerLink } from "@/components/line/friend-tools";
import { fmtJst } from "@/lib/line/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------
// 1:1 チャット＋友だちのタグ/メモ
// ---------------------------------------------------------------
export default async function LineChatPage({ params }: { params: Promise<{ accountId: string; friendId: string }> }) {
  const { accountId, friendId } = await params;
  const { account } = await loadAccountPage(accountId);
  const friend = await db.lineFriend.findFirst({
    where: { id: friendId, accountId },
    include: { enrollments: { where: { status: "ACTIVE" }, include: { scenario: { select: { name: true } } } } },
  });
  if (!friend) notFound();

  // 開いた時点で既読にする
  if (friend.unreadCount > 0) {
    await db.lineFriend.update({ where: { id: friend.id }, data: { unreadCount: 0 } });
  }

  const [messages, scenarios, canned, customer, tagDefs] = await Promise.all([
    db.lineMessage.findMany({ where: { friendId }, orderBy: { createdAt: "asc" }, take: 300 }),
    db.lineScenario.findMany({ where: { accountId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.lineCannedReply.findMany({ where: { accountId }, orderBy: { order: "asc" }, select: { id: true, title: true, text: true } }),
    friend.customerId ? db.customer.findUnique({ where: { id: friend.customerId }, select: { id: true, name: true } }) : Promise.resolve(null),
    db.lineTag.findMany({ where: { accountId }, orderBy: { order: "asc" }, select: { name: true, color: true } }),
  ]);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <AccountHeader account={account} />
      <Link href={`/dashboard/line/${accountId}`} className="text-xs text-zinc-500 hover:underline">← 友だち一覧へ</Link>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <section className="bg-white rounded-xl border border-zinc-200 flex flex-col min-h-[60vh]">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
            {friend.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={friend.pictureUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-zinc-100" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-zinc-100" />
            )}
            <div>
              <p className="text-sm font-bold text-zinc-900">{friend.displayName ?? "（名前未取得）"}</p>
              <p className="text-[11px] text-zinc-400">追加 {fmtJst(friend.followedAt)}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {!friend.isFollowing && (
                <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                  ブロックまたは友だち解除 {fmtJst(friend.unfollowedAt)}
                </span>
              )}
              {friend.mutedAt && (
                <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 rounded px-1.5 py-0.5">ミュート中</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-zinc-50/60">
            {messages.length === 0 && <p className="text-xs text-zinc-400 text-center py-8">まだメッセージはありません</p>}
            {messages.map((m) => m.type === "click" || m.type === "form" ? (
              <div key={m.id} className="flex justify-center">
                <span className="text-[11px] text-zinc-500 bg-zinc-100 rounded-full px-3 py-1">
                  {m.text} ・ {fmtJst(m.createdAt)}
                </span>
              </div>
            ) : (
              <div key={m.id} className={cn("flex", m.direction === "OUT" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                    m.direction === "OUT" ? "bg-emerald-600 text-white rounded-br-sm" : "bg-white border border-zinc-200 text-zinc-900 rounded-bl-sm",
                  )}
                >
                  {m.text}
                  <p className={cn("text-[10px] mt-1", m.direction === "OUT" ? "text-emerald-100" : "text-zinc-400")}>
                    {fmtJst(m.createdAt)}
                    {m.sentVia && m.sentVia !== "manual" && ` ・ ${viaLabel(m.sentVia)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-zinc-100">
            <ChatSendBox accountId={accountId} friendId={friendId} disabled={!friend.isFollowing} canned={canned} friendName={friend.displayName ?? ""} />
          </div>
        </section>

        <aside className="space-y-3">
          <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
            <MuteButton accountId={accountId} friendId={friendId} muted={!!friend.mutedAt} />
            <CustomerLink accountId={accountId} friendId={friendId} customer={customer} />
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <FriendMetaForm accountId={accountId} friendId={friendId} tags={friend.tags} note={friend.note} tagOptions={tagDefs} />
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2">
            <p className="text-[11px] font-bold text-zinc-500">ステップ配信</p>
            {friend.enrollments.length === 0 ? (
              <p className="text-xs text-zinc-400">配信中のシナリオはありません</p>
            ) : (
              friend.enrollments.map((e) => (
                <p key={e.id} className="text-xs text-zinc-700">
                  {e.scenario.name} — 次: {fmtJst(e.nextRunAt)}（{e.nextOrder}通目）
                </p>
              ))
            )}
            <StartScenarioSelect accountId={accountId} friendId={friendId} scenarios={scenarios} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function viaLabel(v: string): string {
  if (v === "greeting") return "あいさつ";
  if (v === "auto") return "自動返信";
  if (v.startsWith("scenario:")) return "ステップ配信";
  if (v.startsWith("broadcast:")) return "一斉配信";
  return v;
}
