// ==============================================================
// ライブフィードの1行の中身（/api/live/detail と グループオフィスのチャット紐づけで共用）
//   ⚠️ 金額は返さない。ライブは金額を出さない面（2026-08-24 代表決定）。
// ==============================================================

import { db } from "@/lib/db";
import { DEAL_STATUS_LABEL, ACTIVITY_LABEL, MOVE_STAGE_LABEL, MOVE_METHOD_LABEL } from "@/lib/live/labels";

export interface LiveDetail {
  title: string;
  subtitle?: string;
  actor: string;
  rows: { label: string; value: string }[];
  timeline?: { at: string; text: string }[];
  href?: string;
  hrefLabel?: string;
}

export type LiveDetailKind = "deal" | "move" | "sent" | "tender";
export const LIVE_DETAIL_KINDS: LiveDetailKind[] = ["deal", "move", "sent", "tender"];

// 外部データ由来のURLをそのままリンクにしない（javascript: 等を弾く）
export function safeHref(url: string | null | undefined): string | undefined {
  const v = (url ?? "").trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return undefined;
}

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" }).format(d);
}

/** 見つからなければ null */
export async function getLiveDetail(kind: string, id: string): Promise<LiveDetail | null> {
  if (!id) return null;

  if (kind === "deal") {
    const deal = await db.deal.findUnique({
      where: { id },
      // amount は取らない
      select: {
        id: true,
        customerId: true,
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
    if (!deal) return null;
    const rows = [
      { label: "段階", value: DEAL_STATUS_LABEL[deal.status] ?? deal.status },
      { label: "動き出し", value: fmt(deal.createdAt) },
      { label: "最終更新", value: fmt(deal.updatedAt) },
    ];
    if (deal.assignedTo?.name) rows.push({ label: "担当", value: deal.assignedTo.name });
    if (deal.expectedCloseDate) rows.push({ label: "受注予定", value: fmt(deal.expectedCloseDate) });
    if (deal.isRegular) rows.push({ label: "種別", value: "レギュラー（継続）" });
    // 入口（動線）: この顧客に対する営業アプローチの記録から
    try {
      const ap = await db.salesApproach.findFirst({
        where: { customerId: deal.customerId },
        orderBy: { createdAt: "asc" },
        select: { method: true, result: true, createdAt: true, lead: { select: { source: true } } },
      });
      if (ap) {
        const METHOD: Record<string, string> = { EMAIL: "メール", FORM: "問い合わせフォーム", DM: "DM", PHONE: "電話", VISIT: "訪問", OTHER: "その他" };
        const SOURCE: Record<string, string> = {
          GOOGLE_PLACES: "リード獲得AI（Googleマップ）",
          GBIZINFO: "gBizINFO",
          CINEMA_AD: "シネマ広告",
          RECRUIT_SEARCH: "採用シグナル",
          CSV_IMPORT: "CSV取込",
          MANUAL: "手入力",
          SIGNBOARD_SCAN: "看板スキャン",
          PR_TIMES_TVCM: "PR TIMES（TVCM）",
        };
        const src = ap.lead?.source ? SOURCE[ap.lead.source] ?? ap.lead.source : null;
        rows.push({
          label: "入口",
          value: `${src ? `${src} → ` : ""}${METHOD[ap.method] ?? ap.method}（${fmt(ap.createdAt)}）`,
        });
      }
    } catch {
      /* 記録が無ければ出さない */
    }
    return {
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
  }

  if (kind === "move") {
    const move = await db.groupMove.findUnique({
      where: { id },
      select: {
        industry: true,
        method: true,
        stage: true,
        note: true,
        companyName: true,
        movedAt: true,
        createdAt: true,
        groupCompany: { select: { name: true, prefecture: true } },
      },
    });
    if (!move) return null;
    return {
      title: move.companyName ?? move.industry,
      subtitle: move.companyName
        ? [move.industry, move.groupCompany.prefecture].filter(Boolean).join(" ・ ")
        : (move.groupCompany.prefecture ?? undefined),
      actor: move.groupCompany.name,
      rows: [
        { label: "当たり方", value: MOVE_METHOD_LABEL[move.method] || "その他" },
        { label: "段階", value: MOVE_STAGE_LABEL[move.stage] ?? move.stage },
        { label: "出した日", value: fmt(move.createdAt) },
        { label: "最終更新", value: fmt(move.movedAt) },
      ],
      timeline: move.note ? [{ at: fmt(move.movedAt), text: move.note }] : [],
      href: `/dashboard/group-moves?industry=${encodeURIComponent(move.industry)}`,
      hrefLabel: "同じ業界の動きを見る",
    };
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
    if (!sent) return null;
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
    return { title: sent.companyName ?? sent.domain ?? "送付先", actor: sent.branch?.name ?? "—", rows };
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
    if (!t) return null;
    const rows = [];
    if (t.expiresAt) rows.push({ label: "期限", value: fmt(t.expiresAt) });
    if (t.fitReason) rows.push({ label: "判定の理由", value: t.fitReason.slice(0, 120) });
    return {
      title: t.projectName,
      subtitle: [t.organizationName, t.prefectureName].filter(Boolean).join(" ・ "),
      actor: "入札ファインダー",
      rows,
      href: safeHref(t.documentUrl) ?? "/dashboard/tender-finder",
      hrefLabel: safeHref(t.documentUrl) ? "公告を開く" : "入札ファインダーへ",
    };
  }

  return null;
}
