import Link from "next/link";
import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";
import { NewEntryPointToggle, EntryPointEditToggle } from "@/components/line/entry-point-form";
import { ActionButton, ConfirmButton } from "@/components/line/action-buttons";
import { deleteLineEntryPoint, toggleLineEntryPoint } from "@/lib/actions/line";
import { addFriendUrl, fmtJst } from "@/lib/line/format";
import { entryPointWindow } from "@/lib/line/service";
import { qrSvg } from "@/lib/line/qr";

export const dynamic = "force-dynamic";

function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 16);
}

export default async function LineEntryPointsPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { account } = await loadAccountPage(accountId);
  const eps = await db.lineEntryPoint.findMany({ where: { accountId }, orderBy: [{ isActive: "desc" }, { startsAt: "desc" }, { createdAt: "desc" }] });
  const url = addFriendUrl(account.basicId);
  const svg = url ? await qrSvg(url, 160) : null;
  const now = new Date();

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <AccountHeader account={account} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-zinc-500">
          セミナーごとに枠を登録 → 当日はQRを映す → 追加した人に自動でタグ → 「タグが付いたら開始」のステップ配信でお礼・資料・予約案内まで自動。
        </p>
        <NewEntryPointToggle accountId={accountId} />
      </div>

      {!url && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          友だち追加URLがまだ取れていません。設定タブの「接続テスト」を押すとベーシックIDを取得します。
        </p>
      )}

      {eps.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">まだ枠はありません。</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {eps.map((ep) => {
            const w = entryPointWindow(ep);
            const live = w ? now >= w.start && now <= w.end : true;
            return (
              <div key={ep.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex gap-4">
                <div className="shrink-0 w-[120px]">
                  {svg ? (
                    <Link href={`/dashboard/line/${accountId}/entry-points/${ep.id}/qr`} title="大きく表示（スライド用）">
                      <div className="w-[120px] h-[120px] [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
                    </Link>
                  ) : (
                    <div className="w-[120px] h-[120px] bg-zinc-100 rounded" />
                  )}
                  <Link href={`/dashboard/line/${accountId}/entry-points/${ep.id}/qr`} className="block text-center text-[11px] text-emerald-700 underline mt-1">
                    スライド用に大きく表示
                  </Link>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm font-bold text-zinc-900 flex items-center gap-2 flex-wrap">
                    {ep.name}
                    <span className={`text-[10px] rounded px-1.5 ${!ep.isActive ? "bg-zinc-100 text-zinc-500" : live ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-500"}`}>
                      {!ep.isActive ? "停止" : live ? "自動タグ 有効中" : "待機"}
                    </span>
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    タグ <code className="bg-zinc-100 rounded px-1">{ep.tag}</code>
                    {ep.askOnFollow ? " ・ 1通目のボタン候補" : ""}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {ep.startsAt ? `${fmtJst(ep.startsAt)} 〜 ${fmtJst(ep.endsAt)}` : "常設（時間帯なし）"}
                    {w && <span className="text-zinc-400">（自動タグ: {fmtJst(w.start)}〜{fmtJst(w.end)}）</span>}
                  </p>
                  <p className="text-xs text-zinc-800">追加 <b className="tabular-nums">{ep.followCount}</b> 人</p>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <ActionButton
                      label={ep.isActive ? "停止する" : "再開する"}
                      action={async () => {
                        "use server";
                        return toggleLineEntryPoint(accountId, ep.id, !ep.isActive);
                      }}
                    />
                    <EntryPointEditToggle
                      accountId={accountId}
                      initial={{ id: ep.id, name: ep.name, tag: ep.tag, startsAt: toLocalInput(ep.startsAt), endsAt: toLocalInput(ep.endsAt), askOnFollow: ep.askOnFollow }}
                    />
                    <ConfirmButton
                      label="削除"
                      confirmLabel="本当に削除"
                      danger
                      action={async () => {
                        "use server";
                        return deleteLineEntryPoint(accountId, ep.id);
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
