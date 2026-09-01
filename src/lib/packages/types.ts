// ==============================================================
// パッケージ台帳 — 共通の型・ラベル・JSON列の読み書き
//   DBの Json 列（deliverables / options / fulfillment / docs）は
//   ここで形を固定し、画面・PDF・見積・AI下書きが同じ形を使う。
// ==============================================================

import type { SalesPackagePriceType, SalesPackageStatus } from "@/generated/prisma/client";

export type PackageDeliverable = { name: string; qty: number; unit: string; spec: string };
export type PackageOption = { name: string; price: number | null; note: string };
export type FulfillmentOwner = "HQ" | "BRANCH" | "PRODUCER";
export type PackageFulfillment = { task: string; owner: FulfillmentOwner; note: string };
export type PackageDoc = { title: string; url: string };

export const STATUS_LABEL: Record<SalesPackageStatus, string> = {
  PROPOSED: "提案中",
  ACTIVE: "稼働中",
  RETIRED: "終了",
};

export const PRICE_TYPE_LABEL: Record<SalesPackagePriceType, string> = {
  ONE_TIME: "一括",
  MONTHLY: "月額",
  INITIAL_PLUS_MONTHLY: "初期＋月額",
};

export const OWNER_LABEL: Record<FulfillmentOwner, string> = {
  HQ: "本部",
  BRANCH: "販売拠点",
  PRODUCER: "制作代表",
};

/** お客様向けの呼び方（資料PDF・公開ページ）。「制作代表」「販売拠点」は内部の言葉なので出さない */
export const CLIENT_OWNER_LABEL: Record<FulfillmentOwner, string> = {
  BRANCH: "担当窓口",
  PRODUCER: "制作チーム",
  HQ: "Ad Arch本部",
};

/** 本部の公開連絡先（公開ページで差出人が無い場合のフォールバック） */
export const HQ_CONTACT = { company: "Ad Arch株式会社", email: "info@adarch.co.jp", phone: "050-1793-9063" };

/** 分類の候補（自由入力も可） */
export const CATEGORY_SUGGESTIONS = ["採用", "サイネージ", "TVer", "SNS", "動画制作", "Web", "イベント", "その他"];

// ---------------------------------------------------------------
// Json列 → 型付き配列（壊れていても落とさない）
// ---------------------------------------------------------------
function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
}
const s = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

export function parseDeliverables(v: unknown): PackageDeliverable[] {
  return arr(v)
    .map((x) => ({ name: s(x.name, 120), qty: n(x.qty) ?? 1, unit: s(x.unit, 20) || "式", spec: s(x.spec, 600) }))
    .filter((x) => x.name);
}
export function parseOptions(v: unknown): PackageOption[] {
  return arr(v)
    .map((x) => ({ name: s(x.name, 120), price: n(x.price), note: s(x.note, 300) }))
    .filter((x) => x.name);
}
export function parseFulfillment(v: unknown): PackageFulfillment[] {
  return arr(v)
    .map((x) => {
      const owner = x.owner === "HQ" || x.owner === "BRANCH" || x.owner === "PRODUCER" ? x.owner : "BRANCH";
      return { task: s(x.task, 160), owner: owner as FulfillmentOwner, note: s(x.note, 300) };
    })
    .filter((x) => x.task);
}
export function parseDocs(v: unknown): PackageDoc[] {
  return arr(v)
    .map((x) => ({ title: s(x.title, 120), url: s(x.url, 1000) }))
    .filter((x) => x.title && /^https?:\/\//i.test(x.url));
}

// ---------------------------------------------------------------
// 価格の表示
// ---------------------------------------------------------------
export const yen = (v: number) => `¥${v.toLocaleString("ja-JP")}`;

/** 「¥350,000」「月額 ¥150,000」「初期 ¥150,000 ＋ 月額 ¥15,000」。未設定なら「価格未設定」 */
export function formatPackagePrice(p: {
  priceType: SalesPackagePriceType;
  initialPrice: number | null;
  monthlyPrice: number | null;
}): string {
  const i = p.initialPrice;
  const m = p.monthlyPrice;
  if (p.priceType === "ONE_TIME") return i != null ? yen(i) : "価格未設定";
  if (p.priceType === "MONTHLY") return m != null ? `月額 ${yen(m)}` : "価格未設定";
  if (i == null && m == null) return "価格未設定";
  return [i != null ? `初期 ${yen(i)}` : null, m != null ? `月額 ${yen(m)}` : null].filter(Boolean).join(" ＋ ");
}

export function hasPrice(p: { priceType: SalesPackagePriceType; initialPrice: number | null; monthlyPrice: number | null }): boolean {
  if (p.priceType === "ONE_TIME") return p.initialPrice != null;
  if (p.priceType === "MONTHLY") return p.monthlyPrice != null;
  return p.initialPrice != null || p.monthlyPrice != null;
}

// ---------------------------------------------------------------
// slug
// ---------------------------------------------------------------
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-龯]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || `pkg-${Date.now().toString(36)}`;
}
