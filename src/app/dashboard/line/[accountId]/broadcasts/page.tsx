import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";
import { BroadcastForm } from "@/components/line/broadcast-form";
import { ConfirmButton } from "@/components/line/action-buttons";
import { cancelLineBroadcast } from "@/lib/actions/line";
import { fmtJst, BROADCAST_STATUS_LABEL } from "@/lib/line/format";

export const dynamic = "force-dynamic";

export default async function LineBroadcastsPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { account } = await loadAccountPage(accountId);
  const [broadcasts, tagRows] = await Promise.all([
    db.lineBroadcast.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.lineFriend.findMany({ where: { accountId }, select: { tags: true } }),
  ]);
  const allTags = [...new Set(tagRows.flatMap((f) => f.tags))].sort();

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <AccountHeader account={account} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-zinc-500">タグで絞って、今すぐ or 予約で送ります。予約分は5分刻みで送信されます。</p>
        <BroadcastForm accountId={accountId} allTags={allTags} />
      </div>

      {broadcasts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">まだ配信はありません。</div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">タイトル</th>
                <th className="text-left px-3 py-2 font-medium">条件</th>
                <th className="text-left px-3 py-2 font-medium">送信日時</th>
                <th className="text-left px-3 py-2 font-medium">状態</th>
                <th className="text-right px-3 py-2 font-medium">対象/送信/失敗</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => (
                <tr key={b.id} className="border-t border-zinc-100 align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-zinc-900">{b.title}</p>
                    <p className="text-zinc-500 line-clamp-2 whitespace-pre-wrap">{b.text}</p>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">
                    {b.filterTags.length ? b.filterTags.join(" / ") : "全員"}
                    {b.excludeTags.length ? ` − ${b.excludeTags.join(" / ")}` : ""}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">{fmtJst(b.sentAt ?? b.scheduledAt)}</td>
                  <td className="px-3 py-2">
                    <span className={b.status === "SENT" ? "text-emerald-700" : b.status === "FAILED" ? "text-red-600" : "text-zinc-600"}>
                      {BROADCAST_STATUS_LABEL[b.status]}
                    </span>
                    {b.error && <p className="text-[10px] text-red-500">{b.error}</p>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.targetCount}/{b.sentCount}/{b.failedCount}</td>
                  <td className="px-3 py-2 text-right">
                    {b.status === "SCHEDULED" && (
                      <ConfirmButton
                        label="取消"
                        confirmLabel="本当に取消"
                        danger
                        action={async () => {
                          "use server";
                          return cancelLineBroadcast(accountId, b.id);
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
