// ==============================================================
// TVer配信実績 — 拠点の一覧。公開済みはグループ全社分が並ぶ（他拠点の事例も営業に使えるように）
//   自社ぶん: 広告主名・金額・詳細ページまで全部
//   他拠点ぶん: 展開場所（商圏）・業種・秒数・期間・予算（売価ベース）・配信結果だけ。広告主名と金額は出さない・詳細は開けない
//   卸値はどの拠点にも存在しない（取込・確認・金額調整は /dashboard/admin/tver-reports＝本部だけ）
// ==============================================================

import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectiveSell } from "@/lib/tver/amount";
import { budgetSellForPeriod, periodDays, periodLabel } from "@/lib/tver/period";
import { SELL_MULTIPLIER } from "@/lib/tver/plan";

export const dynamic = "force-dynamic";
const fmtD = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(d);
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export default async function TverReportsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");
  const me = await db.user.findUnique({ where: { email: session.user.email }, select: { role: true, groupCompanyId: true, groupCompany: { select: { name: true } } } });
  if (!me) redirect("/");
  const isAdmin = me.role === "ADMIN";
  if (!isAdmin && !me.groupCompanyId) {
    return (
      <Empty title="TVer配信実績" body="このアカウントは拠点に紐づいていないため実績を表示できません。本部にご連絡ください。" />
    );
  }

  const reports = await db.tverDeliveryReport.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { periodEnd: "desc" },
    take: 300,
    select: {
      id: true, advertiserName: true, industry: true, areaLabel: true, areaPopulation: true, periodStart: true, periodEnd: true, adSeconds: true,
      impressions: true, completes: true, clicks: true, sellAmount: true, sellAmountAdjusted: true, monthlyBudget: true, confirmedAt: true, partnerNote: true, sharedNote: true,
      groupCompanyId: true, groupCompany: { select: { name: true, prefecture: true } },
    },
  });
  const isMine = (gid: string | null) => isAdmin || (!!me.groupCompanyId && gid === me.groupCompanyId);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <BarChart2 className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">TVer配信実績</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            本部が確認を終えた配信実績です。金額は税抜の媒体費（再生単価×再生数）。お客様への報告にそのまま使えます。<br />
            グループ全社の実績が並びます。<b>貴社ぶん</b>は広告主名をクリックして内訳（県別・デバイス別・年齢別・日別）まで見られます。<b>他の拠点ぶん</b>は「どこで・いくらの予算で・どれだけ届いたか」だけが出ます（広告主名と金額は出ません）。
          </p>
        </div>
        {isAdmin && <Link href="/dashboard/admin/tver-reports" className="ml-auto text-sm text-orange-600 underline">本部の取込・確認へ</Link>}
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">広告主</th>
                <th className="px-3 py-2 text-left">展開場所（商圏）</th>
                <th className="px-3 py-2 text-left">期間</th>
                {isAdmin && <th className="px-3 py-2 text-left">拠点</th>}
                <th className="px-3 py-2 text-right">予算（税抜）</th>
                <th className="px-3 py-2 text-right">表示回数</th>
                <th className="px-3 py-2 text-right">100%再生</th>
                <th className="px-3 py-2 text-right">クリック</th>
                <th className="px-3 py-2 text-right">金額（税抜）</th>
                <th className="px-3 py-2 text-left">確認日</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 && (
                <tr><td colSpan={isAdmin ? 11 : 10} className="px-3 py-10 text-center text-zinc-400">公開された実績はまだありません</td></tr>
              )}
              {reports.map((r) => {
                const mine = isMine(r.groupCompanyId);
                return (
                <tr key={r.id} className={`border-t border-zinc-100 hover:bg-zinc-50/60 ${mine ? "" : "text-zinc-500"}`}>
                  <td className="px-3 py-2">
                    {mine ? (
                      <Link href={`/dashboard/tver-reports/${r.id}`} className="font-medium text-zinc-900 hover:text-orange-600">{r.advertiserName}</Link>
                    ) : (
                      <span className="text-zinc-600">{r.groupCompany?.prefecture ? `${r.groupCompany.prefecture}の拠点` : "他の拠点"}{r.industry ? `・${r.industry}` : ""}</span>
                    )}
                    {r.adSeconds ? <span className="text-xs text-zinc-400 ml-1">{r.adSeconds}秒</span> : null}
                  </td>
                  <td className="px-3 py-2 max-w-[20rem]">
                    <span className="whitespace-nowrap">{r.areaLabel ?? "—"}{r.areaPopulation ? <span className="text-xs text-zinc-400">（{r.areaPopulation.toLocaleString("ja-JP")}人）</span> : null}</span>
                    {r.sharedNote && <span className="block text-xs text-zinc-500 mt-0.5">{r.sharedNote}</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{periodLabel(r.periodStart, r.periodEnd)}</td>
                  {isAdmin && <td className="px-3 py-2 whitespace-nowrap">{r.groupCompany?.name ?? "—"}</td>}
                  <td className="px-3 py-2 text-right tabular-nums">{budgetSellForPeriod(r.monthlyBudget, periodDays(r.periodStart, r.periodEnd), SELL_MULTIPLIER) != null ? yen(budgetSellForPeriod(r.monthlyBudget, periodDays(r.periodStart, r.periodEnd), SELL_MULTIPLIER)!) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.impressions.toLocaleString("ja-JP")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.completes.toLocaleString("ja-JP")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.clicks.toLocaleString("ja-JP")}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{mine ? yen(effectiveSell(r)) : <span className="text-zinc-300">—</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500">{r.confirmedAt ? fmtD(r.confirmedAt) : "—"}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <h2 className="text-lg font-bold text-zinc-900 mb-2">{title}</h2>
      <p className="text-sm text-zinc-500">{body}</p>
    </div>
  );
}
