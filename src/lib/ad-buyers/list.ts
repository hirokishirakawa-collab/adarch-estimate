// ==============================================================
// 広告出稿者ファインダー — 一覧（2026-09-10）
//   画面（/dashboard/ad-buyer-finder）・GET /api/ad-buyers・AI連携（list_ad_buyers）が同じ実装を使う。
//   閲覧範囲はリード管理・周年ファインダーと同じ＝グループ全社分が見える（金額は持たない）。
//   mine: true で自分の担当・自分が保存したものだけ。
// ==============================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { McpViewer } from "@/lib/mcp/os-read-tools";
import { PREFECTURES } from "@/lib/constants/crm";
import { areaLabel } from "@/lib/anniversary/area";
import { platformOf } from "./platforms";

export const AD_BUYER_SORT_KEYS = ["checkedAt", "name", "rating", "ratingCount", "createdAt"] as const;
export type AdBuyerSortKey = (typeof AD_BUYER_SORT_KEYS)[number];

export interface AdBuyerFilters {
  prefecture?: string;
  city?: string;
  platform?: string;
  industry?: string;
  /** YYYY-MM-DD（確認日の範囲） */
  from?: string;
  to?: string;
  mine?: boolean;
  sort?: AdBuyerSortKey;
  dir?: "asc" | "desc";
  limit?: number;
}

export interface AdBuyerRow {
  id: string;
  name: string;
  address: string | null;
  area: string | null;
  industry: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  platforms: string[];
  platformLabels: string[];
  evidenceUrl: string | null;
  rating: number;
  ratingCount: number;
  status: string;
  assignee: string | null;
  isMine: boolean;
  /** ISO */
  checkedAt: string | null;
  createdAt: string;
}

export function parseSort(v: string | null | undefined): AdBuyerSortKey {
  return (AD_BUYER_SORT_KEYS as readonly string[]).includes(v ?? "") ? (v as AdBuyerSortKey) : "checkedAt";
}

export async function listAdBuyers(v: McpViewer, f: AdBuyerFilters): Promise<AdBuyerRow[]> {
  const pref = (f.prefecture ?? "").trim();
  const city = (f.city ?? "").trim();
  const industry = (f.industry ?? "").trim();
  const platform = (f.platform ?? "").trim();
  const dir = f.dir === "asc" ? "asc" : "desc";
  const sort = f.sort ?? "checkedAt";

  const and: Prisma.LeadWhereInput[] = [];
  // 県は prefecture 列か住所のどちらかに含まれていれば拾う（Places 由来は prefecture が空）
  if (pref && (PREFECTURES as readonly string[]).includes(pref)) and.push({ OR: [{ prefecture: pref }, { address: { contains: pref } }, { area: { contains: pref } }] });
  if (city) and.push({ OR: [{ address: { contains: city } }, { area: { contains: city } }] });
  if (industry) and.push({ industry: { contains: industry } });
  if (platform && platformOf(platform)) and.push({ adPlatforms: { has: platform } });
  if (f.from || f.to) {
    and.push({ adPlatformCheckedAt: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(f.to + "T23:59:59+09:00") } : {}) } });
  }
  if (f.mine) and.push({ OR: [{ assigneeId: v.id }, { createdById: v.id }] });

  const where: Prisma.LeadWhereInput = {
    adPlatforms: { isEmpty: false },
    // 却下済み・アーカイブは出さない（リード管理・周年ファインダーと同じ不可視化）
    status: { notIn: ["SKIPPED", "ARCHIVED"] },
    ...(and.length ? { AND: and } : {}),
  };
  const orderBy: Prisma.LeadOrderByWithRelationInput[] =
    sort === "name" ? [{ name: dir }]
    : sort === "rating" ? [{ rating: dir }, { ratingCount: dir }]
    : sort === "ratingCount" ? [{ ratingCount: dir }]
    : sort === "createdAt" ? [{ createdAt: dir }]
    : [{ adPlatformCheckedAt: dir }];

  const rows = await db.lead.findMany({
    where,
    orderBy,
    take: Math.min(2000, Math.max(1, Math.floor(f.limit ?? 2000))),
    select: {
      id: true, name: true, address: true, prefecture: true, area: true, industry: true, phone: true, email: true, websiteUrl: true,
      adPlatforms: true, adPlatformUrl: true, adPlatformCheckedAt: true, rating: true, ratingCount: true, status: true, createdAt: true,
      assigneeId: true, createdById: true, assignee: { select: { name: true } },
    },
  });
  return rows.map((l) => ({
    id: l.id, name: l.name, address: l.address, area: l.area ?? areaLabel(l.prefecture, l.address), industry: l.industry,
    phone: l.phone, email: l.email, websiteUrl: l.websiteUrl,
    platforms: l.adPlatforms, platformLabels: l.adPlatforms.map((k) => platformOf(k)?.label ?? k),
    evidenceUrl: l.adPlatformUrl, rating: l.rating, ratingCount: l.ratingCount, status: l.status,
    assignee: l.assignee?.name ?? null, isMine: l.assigneeId === v.id || l.createdById === v.id,
    checkedAt: l.adPlatformCheckedAt ? l.adPlatformCheckedAt.toISOString() : null, createdAt: l.createdAt.toISOString(),
  }));
}

/** 一括「ファインダーから外す」＝媒体タグを空にする。リード自体は消さない。判定日は残す（再判定で戻らないための印） */
export async function untagAdBuyers(leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  const r = await db.lead.updateMany({
    where: { id: { in: leadIds }, adPlatforms: { isEmpty: false } },
    data: { adPlatforms: [], adPlatformUrl: null },
  });
  return r.count;
}
