// GET /api/tver-reports/[id]/pdf — クライアント提出用の配信レポート（A4縦2ページ）
//   公開済みならグループ全社が出せる。本部は確認待ちでも出せる。卸値・調整の事実は載らない
import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/session";
import { renderHtmlToPdf } from "@/lib/pdf/chrome";
import { buildReportHtml } from "@/lib/tver/report-html";
import { exportFileName, loadReportForExport } from "@/lib/tver/report-export";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const info = await getSessionInfo();
  if (!info) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const data = await loadReportForExport(id, info.role === "ADMIN");
  if (!data) return new NextResponse("Not Found", { status: 404 });
  const { report: r } = data;

  const html = buildReportHtml({
    advertiserName: r.advertiserName,
    branchName: r.groupCompany?.name ?? "Ad Arch Group",
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    areaLabel: r.areaLabel,
    areaPopulation: r.areaPopulation,
    adSeconds: r.adSeconds,
    industry: r.industry,
    sharedNote: r.sharedNote,
    partnerNote: r.partnerNote,
    impressions: r.impressions,
    completes: r.completes,
    clicks: r.clicks,
    amount: data.amount,
    showAmount: req.nextUrl.searchParams.get("amount") !== "0",
    byDate: data.byDate,
    byPref: data.byPref,
    byDevice: data.byDevice,
    byAge: data.byAge,
  });

  const pdf = await renderHtmlToPdf(html, { format: "A4" });
  if (!pdf) return new NextResponse("PDFを作れませんでした（サーバーにChromeがありません）", { status: 500 });
  const name = encodeURIComponent(exportFileName(r.advertiserName, r.periodStart, r.periodEnd, "pdf"));
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${name}` },
  });
}
