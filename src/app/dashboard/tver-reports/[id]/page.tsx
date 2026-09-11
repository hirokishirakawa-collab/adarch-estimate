// TVer配信実績 — 拠点の詳細。自社に紐づいた公開済みだけ。卸値の列は select していない（存在しない）
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { breakdown } from "@/lib/tver/delivery-csv";
import { UNIT_PRICE, type AdSeconds } from "@/lib/tver/plan";
import { BreakdownTables } from "@/components/tver/delivery-breakdown";

export const dynamic = "force-dynamic";
const fmtD = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium" }).format(d);
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export default async function TverReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/");
  const me = await db.user.findUnique({ where: { email: session.user.email }, select: { role: true, groupCompanyId: true } });
  if (!me) redirect("/");
  const isAdmin = me.role === "ADMIN";
  const { id } = await params;

  const r = await db.tverDeliveryReport.findFirst({
    where: { id, status: "PUBLISHED", ...(isAdmin ? {} : { groupCompanyId: me.groupCompanyId ?? "__none__" }) },
    select: {
      id: true, advertiserName: true, industry: true, areaLabel: true, areaPopulation: true, periodStart: true, periodEnd: true, adSeconds: true, partnerNote: true, confirmedAt: true,
      impressions: true, completes: true, clicks: true, sellAmount: true,
      campaignNames: true,
      groupCompany: { select: { name: true } },
      rows: { select: { date: true, campaignName: true, prefecture: true, device: true, gender: true, age: true, impressions: true, q100: true, clicks: true, sellAmount: true } },
    },
  });
  if (!r) notFound();

  const sec = r.adSeconds as AdSeconds | null;
  const byCampaign = breakdown(r.rows, (x) => x.campaignName);
  const byPref = breakdown(r.rows, (x) => x.prefecture);
  const byDevice = breakdown(r.rows, (x) => x.device);
  const byDate = breakdown(r.rows, (x) => fmtD(x.date)).sort((a, b) => a.key.localeCompare(b.key, "ja"));
  const byAge = breakdown(r.rows, (x) => `${x.gender} ${x.age}`);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <Link href="/dashboard/tver-reports" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 mb-4"><ChevronLeft className="w-4 h-4" />一覧へ</Link>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">{r.advertiserName}　{fmtD(r.periodStart)}〜{fmtD(r.periodEnd)}</h1>
        <p className="text-sm text-zinc-500">{r.areaLabel ? `${r.areaLabel}${r.areaPopulation ? `（人口 ${r.areaPopulation.toLocaleString("ja-JP")}人）` : ""}・` : ""}{r.industry ? `${r.industry}・` : ""}{sec ? `${sec}秒・再生単価 ¥${UNIT_PRICE[sec]}（税抜）` : ""}{isAdmin && r.groupCompany ? `・${r.groupCompany.name}` : ""}{r.confirmedAt ? `・本部確認 ${fmtD(r.confirmedAt)}` : ""}</p>
        {r.partnerNote && <p className="mt-2 text-sm text-zinc-800 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 whitespace-pre-wrap">{r.partnerNote}</p>}
      </div>

      <div className="grid sm:grid-cols-4 gap-3 text-sm mb-6">
        <Stat k="表示回数" v={r.impressions.toLocaleString("ja-JP")} />
        <Stat k="100%再生" v={r.completes.toLocaleString("ja-JP")} sub={r.impressions ? `完全視聴率 ${Math.round((r.completes / r.impressions) * 1000) / 10}%` : ""} />
        <Stat k="クリック" v={r.clicks.toLocaleString("ja-JP")} sub={r.impressions ? `CTR ${Math.round((r.clicks / r.impressions) * 10000) / 100}%` : ""} />
        <Stat k="金額（税抜）" v={yen(r.sellAmount)} sub="再生単価×表示回数" strong />
      </div>

      <div className="space-y-6">
        <section className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">キャンペーン別</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500"><tr><th className="text-left py-1">キャンペーン</th><th className="text-right py-1">表示回数</th><th className="text-right py-1">100%再生</th><th className="text-right py-1">クリック</th><th className="text-right py-1">金額（税抜）</th></tr></thead>
            <tbody>
              {byCampaign.map((b) => (
                <tr key={b.key} className="border-t border-zinc-100">
                  <td className="py-1.5 pr-2">{b.key}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.impressions.toLocaleString("ja-JP")}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.completes.toLocaleString("ja-JP")}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.clicks.toLocaleString("ja-JP")}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{yen(b.sellAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <BreakdownTables byPref={byPref} byDevice={byDevice} byDate={byDate} byAge={byAge} />
      </div>
    </div>
  );
}

function Stat({ k, v, sub, strong }: { k: string; v: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${strong ? "border-orange-200 bg-orange-50" : "border-zinc-200 bg-white"}`}>
      <div className="text-xs text-zinc-500">{k}</div>
      <div className={`tabular-nums ${strong ? "text-lg font-bold" : "text-base font-medium"} text-zinc-900`}>{v}</div>
      {sub && <div className="text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}
