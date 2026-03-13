"use server";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEAD_STATUS_OPTIONS, SCORE_ITEMS } from "@/lib/constants/leads";
import type { LeadStatus } from "@/generated/prisma/client";

// ---------------------------------------------------------------
// GET /api/leads/export?format=csv|pdf&status=...&industry=...&area=...&q=...
// ---------------------------------------------------------------
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "csv";
  const q = params.get("q")?.trim() ?? "";
  const statusParam = params.get("status") ?? "";
  const industryParam = params.get("industry") ?? "";
  const areaParam = params.get("area") ?? "";

  // WHERE 条件
  type WhereInput = {
    OR?: Array<Record<string, unknown>>;
    status?: LeadStatus;
    industry?: string;
    area?: { contains: string; mode: "insensitive" };
  };
  const where: WhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
    ];
  }
  if (statusParam) where.status = statusParam as LeadStatus;
  if (industryParam) where.industry = industryParam;
  if (areaParam) where.area = { contains: areaParam, mode: "insensitive" };

  const leads = await db.lead.findMany({
    where,
    include: {
      assignee: { select: { name: true, email: true } },
    },
    orderBy: { scoreTotal: "desc" },
  });

  if (format === "pdf") {
    return generatePdf(leads);
  }
  return generateCsv(leads);
}

// ---------------------------------------------------------------
// CSV 生成
// ---------------------------------------------------------------
type LeadRow = Awaited<ReturnType<typeof db.lead.findMany>>[number] & {
  assignee: { name: string | null; email: string } | null;
};

function getStatusLabel(status: string): string {
  return LEAD_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function generateCsv(leads: LeadRow[]) {
  const header = [
    "企業名",
    "住所",
    "電話番号",
    "Webサイト",
    "Google評価",
    "レビュー数",
    "スコア（合計）",
    ...SCORE_ITEMS.map((s) => `スコア: ${s.label}`),
    "AIコメント",
    "業種",
    "エリア",
    "ステータス",
    "担当者",
    "メモ",
    "Google Maps",
    "登録日",
  ];

  const rows = leads.map((lead) => {
    const breakdown = (lead.scoreBreakdown ?? {}) as Record<string, number>;
    return [
      lead.name,
      lead.address ?? "",
      lead.phone ?? "",
      lead.websiteUrl ?? "",
      lead.rating.toString(),
      lead.ratingCount.toString(),
      lead.scoreTotal.toString(),
      ...SCORE_ITEMS.map((s) => (breakdown[s.key] ?? "").toString()),
      lead.scoreComment ?? "",
      lead.industry ?? "",
      lead.area ?? "",
      getStatusLabel(lead.status),
      lead.assignee?.name ?? "",
      lead.memo ?? "",
      lead.mapsUrl ?? "",
      lead.createdAt.toISOString().split("T")[0],
    ];
  });

  const csvContent = [header, ...rows]
    .map((row) =>
      row.map((cell) => {
        const s = String(cell).replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s}"`
          : s;
      }).join(",")
    )
    .join("\n");

  // BOM付きUTF-8 (Excel互換)
  const bom = "\uFEFF";
  const body = bom + csvContent;

  const now = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads_${now}.csv"`,
    },
  });
}

// ---------------------------------------------------------------
// PDF 生成（@react-pdf/renderer）
// ---------------------------------------------------------------
async function generatePdf(leads: LeadRow[]) {
  const ReactPDF = await import("@react-pdf/renderer");
  const { Document, Page, Text, View, Font, renderToBuffer } = ReactPDF;
  const React = (await import("react")).default;

  // 日本語フォント登録（Noto Sans JP）
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-400-normal.woff", fontWeight: 400 },
      { src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-700-normal.woff", fontWeight: 700 },
    ],
  });

  const styles = ReactPDF.StyleSheet.create({
    page: { fontFamily: "NotoSansJP", fontSize: 8, padding: 30, paddingBottom: 50 },
    title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
    subtitle: { fontSize: 8, color: "#71717a", marginBottom: 16 },
    tableHeader: { flexDirection: "row", backgroundColor: "#f4f4f5", borderBottomWidth: 1, borderColor: "#e4e4e7", paddingVertical: 4 },
    tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#e4e4e7", paddingVertical: 3 },
    cellName: { width: "18%", paddingHorizontal: 3, fontWeight: 700 },
    cellAddress: { width: "20%", paddingHorizontal: 3 },
    cellPhone: { width: "10%", paddingHorizontal: 3 },
    cellScore: { width: "6%", paddingHorizontal: 3, textAlign: "center" },
    cellIndustry: { width: "8%", paddingHorizontal: 3 },
    cellArea: { width: "8%", paddingHorizontal: 3 },
    cellStatus: { width: "7%", paddingHorizontal: 3 },
    cellComment: { width: "23%", paddingHorizontal: 3 },
    pageNumber: { position: "absolute", fontSize: 7, bottom: 20, left: 0, right: 0, textAlign: "center", color: "#a1a1aa" },
    summaryBox: { flexDirection: "row", gap: 12, marginBottom: 12 },
    summaryItem: { backgroundColor: "#f4f4f5", borderRadius: 4, padding: 8, flex: 1 },
    summaryLabel: { fontSize: 7, color: "#71717a" },
    summaryValue: { fontSize: 14, fontWeight: 700 },
  });

  // ステータスごとのカウント
  const statusCounts: Record<string, number> = {};
  for (const lead of leads) {
    statusCounts[lead.status] = (statusCounts[lead.status] ?? 0) + 1;
  }

  const now = new Date().toLocaleDateString("ja-JP");

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", orientation: "landscape", style: styles.page },
      // タイトル
      React.createElement(Text, { style: styles.title }, "リード管理レポート"),
      React.createElement(Text, { style: styles.subtitle }, `出力日: ${now} / 全 ${leads.length} 件`),
      // サマリー
      React.createElement(
        View,
        { style: styles.summaryBox },
        React.createElement(
          View,
          { style: styles.summaryItem },
          React.createElement(Text, { style: styles.summaryLabel }, "総リード数"),
          React.createElement(Text, { style: styles.summaryValue }, String(leads.length))
        ),
        ...LEAD_STATUS_OPTIONS.map((opt) =>
          React.createElement(
            View,
            { key: opt.value, style: styles.summaryItem },
            React.createElement(Text, { style: styles.summaryLabel }, `${opt.icon} ${opt.label}`),
            React.createElement(Text, { style: styles.summaryValue }, String(statusCounts[opt.value] ?? 0))
          )
        )
      ),
      // テーブルヘッダー
      React.createElement(
        View,
        { style: styles.tableHeader, fixed: true },
        React.createElement(Text, { style: styles.cellName }, "企業名"),
        React.createElement(Text, { style: styles.cellAddress }, "住所"),
        React.createElement(Text, { style: styles.cellPhone }, "電話番号"),
        React.createElement(Text, { style: styles.cellScore }, "スコア"),
        React.createElement(Text, { style: styles.cellIndustry }, "業種"),
        React.createElement(Text, { style: styles.cellArea }, "エリア"),
        React.createElement(Text, { style: styles.cellStatus }, "ステータス"),
        React.createElement(Text, { style: styles.cellComment }, "AIコメント")
      ),
      // テーブル行
      ...leads.map((lead, i) =>
        React.createElement(
          View,
          { key: lead.id, style: { ...styles.tableRow, backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafafa" }, wrap: false },
          React.createElement(Text, { style: styles.cellName }, lead.name),
          React.createElement(Text, { style: styles.cellAddress }, lead.address ?? ""),
          React.createElement(Text, { style: styles.cellPhone }, lead.phone ?? ""),
          React.createElement(Text, { style: styles.cellScore }, String(lead.scoreTotal)),
          React.createElement(Text, { style: styles.cellIndustry }, lead.industry ?? ""),
          React.createElement(Text, { style: styles.cellArea }, lead.area ?? ""),
          React.createElement(Text, { style: styles.cellStatus }, getStatusLabel(lead.status)),
          React.createElement(Text, { style: styles.cellComment }, lead.scoreComment ?? "")
        )
      ),
      // ページ番号
      React.createElement(
        Text,
        { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}` },
      )
    )
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(doc as any);
  const uint8 = new Uint8Array(buffer);
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="leads_${dateStr}.pdf"`,
    },
  });
}
