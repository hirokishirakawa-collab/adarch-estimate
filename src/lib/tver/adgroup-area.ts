// ==============================================================
// 広告グループごとの商圏（TVerでエリアを設定する単位）
//   優先順: 申込の市区町村（レポート全体が1申込のとき） → 広告グループ名／キャンペーン名の市区町村名 → 前回（同じ広告主・同じ広告グループ名）→ その広告グループの明細の県全域
//   本部が手で選んだもの（MANUAL）は再取込でも上書きしない
// ==============================================================

import type { Prisma } from "@/generated/prisma/client";
import { areaFromNames, areaFromPrefectures, type ReportArea } from "@/lib/tver/report-area";

export type AdGroupAreaInput = { adGroupName: string; campaignName: string; prefecture: string };
export type AdGroupArea = { adGroupName: string; areaLabel: string | null; areaPopulation: number | null; areaSource: string | null };

export function resolveAdGroupAreas(
  rows: AdGroupAreaInput[],
  opts: { orderArea?: ReportArea | null; prev?: Map<string, ReportArea>; keep?: Map<string, AdGroupArea> },
): AdGroupArea[] {
  const groups = new Map<string, { campaigns: Set<string>; prefs: Set<string> }>();
  for (const r of rows) {
    const g = groups.get(r.adGroupName) ?? { campaigns: new Set<string>(), prefs: new Set<string>() };
    if (r.campaignName) g.campaigns.add(r.campaignName);
    if (r.prefecture) g.prefs.add(r.prefecture);
    groups.set(r.adGroupName, g);
  }
  const out: AdGroupArea[] = [];
  for (const [name, g] of groups) {
    const kept = opts.keep?.get(name);
    if (kept && kept.areaSource === "MANUAL") {
      out.push(kept);
      continue;
    }
    const prefs = [...g.prefs];
    const byName = areaFromNames(prefs, [name, ...g.campaigns]);
    if (byName) {
      out.push({ adGroupName: name, ...byName, areaSource: "NAME" });
      continue;
    }
    if (opts.orderArea) {
      out.push({ adGroupName: name, ...opts.orderArea, areaSource: "ORDER" });
      continue;
    }
    const prev = opts.prev?.get(name);
    if (prev) {
      out.push({ adGroupName: name, ...prev, areaSource: "PREV" });
      continue;
    }
    const byPref = areaFromPrefectures(prefs);
    out.push(byPref ? { adGroupName: name, ...byPref, areaSource: "PREF" } : { adGroupName: name, areaLabel: null, areaPopulation: null, areaSource: null });
  }
  return out;
}

/** 取込・再取込のたびに広告グループ表を同期（MANUALは保持・消えた広告グループは残す） */
export async function syncAdGroupAreas(
  tx: Prisma.TransactionClient,
  reportId: string,
  rows: AdGroupAreaInput[],
  opts: { orderArea?: ReportArea | null; prev?: Map<string, ReportArea> },
) {
  const existing = await tx.tverDeliveryAdGroup.findMany({ where: { reportId } });
  const keep = new Map(existing.map((e) => [e.adGroupName, { adGroupName: e.adGroupName, areaLabel: e.areaLabel, areaPopulation: e.areaPopulation, areaSource: e.areaSource }]));
  const resolved = resolveAdGroupAreas(rows, { ...opts, keep });
  for (const a of resolved) {
    await tx.tverDeliveryAdGroup.upsert({
      where: { reportId_adGroupName: { reportId, adGroupName: a.adGroupName } },
      create: { reportId, ...a },
      update: { areaLabel: a.areaLabel, areaPopulation: a.areaPopulation, areaSource: a.areaSource },
    });
  }
  return resolved;
}

/** 同じ広告主の直近レポートの広告グループ別商圏（名前で引き継ぐ） */
export async function prevAdGroupAreas(tx: Prisma.TransactionClient | { tverDeliveryAdGroup: Prisma.TransactionClient["tverDeliveryAdGroup"] }, advertiserTverId: string, excludeReportId?: string): Promise<Map<string, ReportArea>> {
  const list = await tx.tverDeliveryAdGroup.findMany({
    where: { report: { advertiserTverId, ...(excludeReportId ? { id: { not: excludeReportId } } : {}) }, areaLabel: { not: null }, areaPopulation: { not: null } },
    orderBy: { report: { createdAt: "desc" } },
    select: { adGroupName: true, areaLabel: true, areaPopulation: true },
    take: 500,
  });
  const m = new Map<string, ReportArea>();
  for (const a of list) if (!m.has(a.adGroupName) && a.areaLabel && a.areaPopulation) m.set(a.adGroupName, { areaLabel: a.areaLabel, areaPopulation: a.areaPopulation });
  return m;
}
