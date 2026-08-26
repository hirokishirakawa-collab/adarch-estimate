import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";
import { BroadcastForm } from "@/components/line/broadcast-form";
import { ConfirmButton } from "@/components/line/action-buttons";
import { cancelLineBroadcast } from "@/lib/actions/line";
import { fmtJst, BROADCAST_STATUS_LABEL } from "@/lib/line/format";
import { funnelBySource } from "@/lib/line/service";

export const dynamic = "force-dynamic";

export default async function LineBroadcastsPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { account } = await loadAccountPage(accountId);
  const [broadcasts, tagRows] = await Promise.all([
    db.lineBroadcast.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.lineFriend.findMany({ where: { accountId }, select: { tags: true } }),
  ]);
  const allTags = [...new Set(tagRows.flatMap((f) => f.tags))].sort();
  const conversionTag = account.conversionTag?.trim() || "成約";
  const funnel = await funnelBySource(accountId, broadcasts.filter((b) => b.status === "SENT").map((b) => `broadcast:${b.id}`), conversionTag);
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <AccountHeader account={account} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-zinc-500">タグで絞って、今すぐ or 予約で送ります。予約分は1分ごとに確認して送信されます。右側の列は配信後7日以内の反応（人数・ラストタッチ）、成約はタグ「{conversionTag}」です。</p>
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
                <th className="text-right px-3 py-2 font-medium" title="配信後7日以内・人数">クリック</th>
                <th className="text-right px-3 py-2 font-medium">回答</th>
                <th className="text-right px-3 py-2 font-medium">予約</th>
                <th className="text-right px-3 py-2 font-medium" title={`タグ「${conversionTag}」`}>成約</th>
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
                  {(() => {
                    const f = funnel.get(`broadcast:${b.id}`);
                    const d = f?.reached ?? b.sentCount;
                    return (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums">{f ? `${f.clicked}（${pct(f.clicked, d)}）` : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f ? `${f.formed}（${pct(f.formed, d)}）` : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f ? `${f.booked}（${pct(f.booked, d)}）` : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">{f ? `${f.converted}（${pct(f.converted, d)}）` : "—"}</td>
                      </>
                    );
                  })()}
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
