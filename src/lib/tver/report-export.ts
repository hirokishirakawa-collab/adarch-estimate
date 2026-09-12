// TVer配信実績の書き出し（PDF・CSV）で使う共通の読み取り。
//   公開済みならグループ全社が出せる（2026-09-12 代表決定＝拠点間は完全公開）。本部は確認待ちでも出せる
//   卸値・裏計算・調整したことは含めない＝クライアントに渡る紙・表に出ない

import { db } from "@/lib/db";
import { breakdown } from "@/lib/tver/delivery-csv";
import { allocateBreakdown, effectiveSell } from "@/lib/tver/amount";

export async function loadReportForExport(id: string, isAdmin: boolean) {
  const r = await db.tverDeliveryReport.findFirst({
    where: { id, ...(isAdmin ? {} : { status: "PUBLISHED" }) },
    select: {
      id: true, advertiserName: true, industry: true, areaLabel: true, areaPopulation: true,
      periodStart: true, periodEnd: true, adSeconds: true, sharedNote: true, partnerNote: true,
      impressions: true, completes: true, clicks: true, sellAmount: true, sellAmountAdjusted: true,
      groupCompany: { select: { name: true } },
      rows: { select: { date: true, campaignName: true, adGroupName: true, prefecture: true, device: true, gender: true, age: true, impressions: true, q100: true, clicks: true, sellAmount: true } },
    },
  });
  if (!r) return null;

  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const byDateRaw = new Map<string, { date: Date; impressions: number; completes: number; clicks: number }>();
  for (const x of r.rows) {
    const k = day(x.date);
    const cur = byDateRaw.get(k) ?? { date: x.date, impressions: 0, completes: 0, clicks: 0 };
    cur.impressions += x.impressions; cur.completes += x.q100; cur.clicks += x.clicks;
    byDateRaw.set(k, cur);
  }

  return {
    report: r,
    amount: effectiveSell(r),
    byDate: [...byDateRaw.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, v]) => ({ key, ...v })),
    byCampaign: allocateBreakdown(breakdown(r.rows, (x) => x.campaignName), r),
    byAdGroup: allocateBreakdown(breakdown(r.rows, (x) => x.adGroupName), r),
    byPref: allocateBreakdown(breakdown(r.rows, (x) => x.prefecture), r),
    byDevice: allocateBreakdown(breakdown(r.rows, (x) => x.device), r),
    byAge: allocateBreakdown(breakdown(r.rows, (x) => `${x.gender} ${x.age}`), r),
    byDateAllocated: allocateBreakdown(breakdown(r.rows, (x) => day(x.date)), r).sort((a, b) => a.key.localeCompare(b.key)),
  };
}

/** ファイル名に使える形に（Content-Disposition の filename* にそのまま入れる） */
export const exportFileName = (advertiser: string, start: Date, end: Date, ext: string) => {
  const d = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(x).replace(/-/g, "");
  return `TVer配信レポート_${advertiser.replace(/[\\/:*?"<>|]/g, "")}_${d(start)}-${d(end)}.${ext}`;
};
