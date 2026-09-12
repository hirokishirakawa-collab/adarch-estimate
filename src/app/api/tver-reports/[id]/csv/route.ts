// GET /api/tver-reports/[id]/csv — 配信実績の数字（Excelでそのまま開けるUTF-8 BOM）
//   サマリー＋日別・キャンペーン別・商圏別・県別・デバイス別・性別年齢別を1ファイルに縦に並べる
//   卸値・卸CPM・裏計算・調整の事実は含めない
import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/session";
import { exportFileName, loadReportForExport } from "@/lib/tver/report-export";
import { FREQ } from "@/lib/tver/plan";

export const runtime = "nodejs";

const q = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (...cells: (string | number)[]) => cells.map(q).join(",");
const pct = (a: number, b: number, d = 1) => (b > 0 ? `${(Math.round((a / b) * 10 ** (d + 2)) / 10 ** d).toFixed(d)}%` : "");
const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(x);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const info = await getSessionInfo();
  if (!info) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const data = await loadReportForExport(id, info.role === "ADMIN");
  if (!data) return new NextResponse("Not Found", { status: 404 });
  const { report: r, amount } = data;

  const lines: string[] = [];
  lines.push(row("TVer配信レポート"));
  lines.push(row("広告主", r.advertiserName));
  lines.push(row("担当", r.groupCompany?.name ?? ""));
  lines.push(row("期間", `${day(r.periodStart)}〜${day(r.periodEnd)}`));
  lines.push(row("配信エリア", r.areaLabel ?? ""), row("エリア人口", r.areaPopulation ?? ""));
  lines.push(row("秒数", r.adSeconds ?? ""));
  lines.push(row("表示回数", r.impressions), row("完全視聴", r.completes), row("完全視聴率", pct(r.completes, r.impressions)));
  lines.push(row("クリック", r.clicks), row("CTR", pct(r.clicks, r.impressions, 2)));
  lines.push(row("推定到達人数", Math.round(r.impressions / FREQ)));
  if (r.areaPopulation) lines.push(row("住民比", pct(Math.round(r.impressions / FREQ), r.areaPopulation)));
  lines.push(row("金額（税抜）", amount));
  if (r.impressions > 0) lines.push(row("売CPM（1,000回表示あたり）", Math.round((amount / r.impressions) * 1000)));
  if (r.sharedNote) lines.push(row("補足", r.sharedNote));

  const section = (title: string, keyLabel: string, rows: { key: string; impressions: number; completes: number; clicks: number; sellAmount: number }[]) => {
    lines.push("", row(title));
    lines.push(row(keyLabel, "表示回数", "完全視聴", "完全視聴率", "クリック", "金額（税抜）", "構成比"));
    for (const b of rows) lines.push(row(b.key, b.impressions, b.completes, pct(b.completes, b.impressions), b.clicks, b.sellAmount, pct(b.impressions, r.impressions)));
  };
  section("日別", "日付", data.byDateAllocated);
  section("キャンペーン別", "キャンペーン", data.byCampaign);
  section("商圏別（広告グループ）", "広告グループ", data.byAdGroup);
  section("都道府県別", "都道府県", data.byPref);
  section("デバイス別", "デバイス", data.byDevice);
  section("性別・年齢別", "性別 年齢", data.byAge);

  const name = encodeURIComponent(exportFileName(r.advertiserName, r.periodStart, r.periodEnd, "csv"));
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${name}` },
  });
}
