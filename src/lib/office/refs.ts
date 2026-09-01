// ==============================================================
// チャットの「紐づけ」— OSで流れている案件をそのまま添えて聞く
//   クライアントは {kind,id}（または url）だけ送り、題名などはサーバーで取り直す
//   （改ざん防止＋金額を混ぜない）。取れたものをスナップショットで保存する。
// ==============================================================

import { db } from "@/lib/db";
import { getLiveDetail, LIVE_DETAIL_KINDS, safeHref, type LiveDetail } from "@/lib/live/detail";

export const REF_KINDS = ["deal", "move", "sent", "tender", "customer", "project", "package", "url"] as const;
export type RefKind = (typeof REF_KINDS)[number];

export const REF_LABEL: Record<RefKind, string> = {
  deal: "商談",
  move: "動き",
  sent: "送付",
  tender: "入札○",
  customer: "顧客",
  project: "案件",
  package: "パッケージ",
  url: "OSの画面",
};

export interface ChatRef {
  kind: RefKind;
  id: string | null;
  title: string;
  sub: string | null;
  href: string | null;
}

export interface RefInput {
  kind?: unknown;
  id?: unknown;
  href?: unknown;
}

function isRefKind(v: unknown): v is RefKind {
  return typeof v === "string" && (REF_KINDS as readonly string[]).includes(v);
}

/** OS内のパスだけ許す（/dashboard/…） */
function osPath(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  const m = /^(?:https?:\/\/[^/]+)?(\/dashboard\/[^\s"'<>]*)$/.exec(t);
  return m ? m[1] : null;
}

/** 入力を検証し、題名などを取り直して返す。使えなければ null */
export async function resolveRef(input: RefInput | null | undefined): Promise<ChatRef | null> {
  if (!input || !isRefKind(input.kind)) return null;
  const kind = input.kind;

  if (kind === "url") {
    const href = osPath(input.href);
    if (!href) return null;
    const seg = href.split("?")[0].split("/").filter(Boolean);
    return { kind, id: null, title: seg.slice(1).join(" › ") || "ダッシュボード", sub: null, href };
  }

  const id = typeof input.id === "string" && input.id.length > 0 && input.id.length < 64 ? input.id : null;
  if (!id) return null;

  if ((LIVE_DETAIL_KINDS as readonly string[]).includes(kind)) {
    const d = await getLiveDetail(kind, id);
    if (!d) return null;
    return { kind, id, title: d.title, sub: d.subtitle ?? d.actor ?? null, href: safeHref(d.href) ?? null };
  }
  if (kind === "customer") {
    const c = await db.customer.findUnique({ where: { id }, select: { name: true, industry: true, prefecture: true } });
    if (!c) return null;
    return {
      kind,
      id,
      title: c.name,
      sub: [c.industry, c.prefecture].filter(Boolean).join(" ・ ") || null,
      href: `/dashboard/customers/${id}`,
    };
  }
  if (kind === "project") {
    const p = await db.project.findUnique({ where: { id }, select: { title: true, status: true } });
    if (!p) return null;
    return { kind, id, title: p.title, sub: p.status ?? null, href: `/dashboard/projects/${id}` };
  }
  if (kind === "package") {
    // パッケージ＝議論の軸。sub は分類と状態（金額はチャットに出さない）
    const p = await db.salesPackage.findUnique({ where: { id }, select: { name: true, slug: true, category: true, status: true } });
    if (!p) return null;
    const st = p.status === "ACTIVE" ? "稼働中" : p.status === "PROPOSED" ? "提案中" : "終了";
    return { kind, id, title: p.name, sub: `${p.category} ・ ${st}`, href: `/dashboard/packages/${p.slug}` };
  }
  return null;
}

/** アーチくんに渡す文脈（金額は元から含まない） */
export async function refContextForBot(ref: ChatRef): Promise<string> {
  const head = `【紐づけ】${REF_LABEL[ref.kind]}: ${ref.title}${ref.sub ? `（${ref.sub}）` : ""}`;
  if (ref.id && (LIVE_DETAIL_KINDS as readonly string[]).includes(ref.kind)) {
    try {
      const d: LiveDetail | null = await getLiveDetail(ref.kind, ref.id);
      if (d) {
        const rows = d.rows.map((r) => `${r.label}: ${r.value}`).join(" / ");
        const tl = (d.timeline ?? []).map((t) => `${t.at} ${t.text}`).join(" / ");
        return [head, rows && `詳細: ${rows}`, tl && `経過: ${tl}`].filter(Boolean).join("\n");
      }
    } catch {
      /* 取れなければ見出しだけ */
    }
  }
  if (ref.id && ref.kind === "package") {
    // 中身・分担・規定を渡す（価格は渡さない＝チャットは金額を書かない場所）
    try {
      const p = await db.salesPackage.findUnique({
        where: { id: ref.id },
        select: { painPoints: true, summary: true, deliverables: true, fulfillment: true, rules: true, talkTrack: true, leadTime: true },
      });
      if (p) {
        const { parseDeliverables, parseFulfillment } = await import("@/lib/packages/types");
        const dl = parseDeliverables(p.deliverables).map((d) => `${d.name}×${d.qty}${d.unit}`).join("・");
        const ff = parseFulfillment(p.fulfillment).map((f) => `${f.task}=${f.owner}`).join("・");
        return [
          head,
          p.painPoints && `悩み: ${p.painPoints}`,
          p.summary && `概要: ${p.summary}`,
          dl && `届くもの: ${dl}`,
          p.leadTime && `納期: ${p.leadTime}`,
          ff && `分担: ${ff}`,
          p.talkTrack && `切り口: ${p.talkTrack}`,
          p.rules && `規定: ${p.rules}`,
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 2400);
      }
    } catch {
      /* 見出しだけ */
    }
  }
  return head;
}
