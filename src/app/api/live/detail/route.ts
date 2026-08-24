export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DEAL_STATUS_LABEL,
  ACTIVITY_LABEL,
  MOVE_STAGE_LABEL,
  MOVE_METHOD_LABEL,
} from "@/lib/live/labels";

// ---------------------------------------------------------------
// GET /api/live/detail?kind=deal|move|sent|tender&id=xxx
//   ライブフィードの1行を押したときに開くパネルの中身。
//   ⚠️ 金額は返さない。ライブは金額を出さない面（2026-08-24 代表決定）。
//      商談の見積金額を知りたいときは商談画面で見る（そちらは作成者と本部だけ見える）。
// ---------------------------------------------------------------

export interface LiveDetail {
  title: string;
  subtitle?: string;
  actor: string;
  rows: { label: string; value: string }[];
  timeline?: { at: string; text: string }[];
  href?: string;
  hrefLabel?: string;
}

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(d);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // フィード本体と同じ線引き。全社名が出る面なのでデモ・停止中には返さない
  if (session.user.email === "demo@adarch.co.jp" || session.user.isActive === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const kind = req.nextUrl.searchParams.get("kind") ?? "";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Bad Request" }, { status: 400 });

  try {
    if (kind === "deal") {
      const deal = await db.deal.findUnique({
        where: { id },
        // amount は取らない
        select: {
          id: true,
          status: true,
          updatedAt: true,
          createdAt: true,
          expectedCloseDate: true,
          isRegular: true,
          customer: { select: { name: true, industry: true, prefecture: true } },
          branch: { select: { name: true } },
          assignedTo: { select: { name: true } },
          dealLogs: {
            where: { type: { not: "SYSTEM" } },
            select: { createdAt: true, type: true, content: true },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
      });
      if (!deal) return NextResponse.json({ error: "Not Found" }, { status: 404 });

      const rows = [
        { label: "段階", value: DEAL_STATUS_LABEL[deal.status] ?? deal.status },
        { label: "動き出し", value: fmt(deal.createdAt) },
        { label: "最終更新", value: fmt(deal.updatedAt) },
      ];
      if (deal.assignedTo?.name) rows.push({ label: "担当", value: deal.assignedTo.name });
      if (deal.expectedCloseDate) {
        rows.push({ label: "受注予定", value: fmt(deal.expectedCloseDate) });
      }
      if (deal.isRegular) rows.push({ label: "種別", value: "レギュラー（継続）" });

      const detail: LiveDetail = {
        title: deal.customer.name,
        subtitle: [deal.customer.industry, deal.customer.prefecture].filter(Boolean).join(" ・ "),
        actor: deal.branch.name,
        rows,
        timeline: deal.dealLogs.map((l) => ({
          at: fmt(l.createdAt),
          text: `${ACTIVITY_LABEL[l.type] ?? "フォロー"}${l.content ? ` — ${l.content.slice(0, 60)}` : ""}`,
        })),
        href: `/dashboard/deals/${deal.id}`,
        hrefLabel: "商談を開く",
      };
      return NextResponse.json(detail);
    }

    if (kind === "move") {
      const move = await db.groupMove.findUnique({
        where: { id },
        select: {
          industry: true,
          method: true,
          stage: true,
          note: true,
          movedAt: true,
          createdAt: true,
          groupCompany: { select: { name: true, prefecture: true } },
        },
      });
      if (!move) return NextResponse.json({ error: "Not Found" }, { status: 404 });

      const rows = [
        { label: "当たり方", value: MOVE_METHOD_LABEL[move.method] || "その他" },
        { label: "段階", value: MOVE_STAGE_LABEL[move.stage] ?? move.stage },
        { label: "出した日", value: fmt(move.createdAt) },
        { label: "最終更新", value: fmt(move.movedAt) },
      ];

      const detail: LiveDetail = {
        title: move.industry,
        subtitle: move.groupCompany.prefecture ?? undefined,
        actor: move.groupCompany.name,
        rows,
        timeline: move.note ? [{ at: fmt(move.movedAt), text: move.note }] : [],
        href: `/dashboard/group-moves?industry=${encodeURIComponent(move.industry)}`,
        hrefLabel: "同じ業界の動きを見る",
      };
      return NextResponse.json(detail);
    }

    if (kind === "sent") {
      const sent = await db.autoSalesSentDomain.findUnique({
        where: { id },
        select: {
          companyName: true,
          domain: true,
          sentAt: true,
          hasResponse: true,
          source: true,
          sentBy: true,
          branch: { select: { name: true } },
        },
      });
      if (!sent) return NextResponse.json({ error: "Not Found" }, { status: 404 });

      const rows = [
        { label: "送った日", value: fmt(sent.sentAt) },
        { label: "反響", value: sent.hasResponse ? "あり" : "まだ" },
      ];
      const SOURCE_LABEL: Record<string, string> = {
        OUTREACH: "アウトリーチ（メール）",
        LEAD_FORM: "営業フォーム",
        AUTO_SALES: "旧・自動営業",
      };
      if (sent.source) rows.push({ label: "経路", value: SOURCE_LABEL[sent.source] ?? sent.source });
      if (sent.domain) rows.push({ label: "サイト", value: sent.domain });

      const detail: LiveDetail = {
        title: sent.companyName ?? sent.domain ?? "送付先",
        actor: sent.branch?.name ?? "—",
        rows,
      };
      return NextResponse.json(detail);
    }

    if (kind === "tender") {
      const t = await db.tender.findUnique({
        where: { id },
        select: {
          projectName: true,
          organizationName: true,
          prefectureName: true,
          expiresAt: true,
          fitReason: true,
          documentUrl: true,
        },
      });
      if (!t) return NextResponse.json({ error: "Not Found" }, { status: 404 });

      const rows = [];
      if (t.expiresAt) rows.push({ label: "期限", value: fmt(t.expiresAt) });
      if (t.fitReason) rows.push({ label: "判定の理由", value: t.fitReason.slice(0, 120) });

      const detail: LiveDetail = {
        title: t.projectName,
        subtitle: [t.organizationName, t.prefectureName].filter(Boolean).join(" ・ "),
        actor: "入札ファインダー",
        rows,
        href: t.documentUrl ?? "/dashboard/tender-finder",
        hrefLabel: t.documentUrl ? "公告を開く" : "入札ファインダーへ",
      };
      return NextResponse.json(detail);
    }

    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  } catch (e) {
    console.error("[live/detail]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
