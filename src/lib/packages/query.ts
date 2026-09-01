// ==============================================================
// パッケージ台帳 — 読み取り（一覧・詳細・実績）
// ==============================================================

import { db } from "@/lib/db";
import type { SalesPackageStatus } from "@/generated/prisma/client";
import { formatPackagePrice } from "./types";

/** 営業フォーム／見積／チャットに並べる「稼働中」だけの軽い形 */
export async function getActivePackagesLite() {
  const rows = await db.salesPackage.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      category: true,
      priceType: true,
      initialPrice: true,
      monthlyPrice: true,
      pitchText: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    category: r.category,
    priceLabel: formatPackagePrice(r),
    pitchText: r.pitchText ?? "",
  }));
}

export type PackageStats = {
  sent: number; // 送付数（FORM_SENT ログ）
  replied: number; // 返信あり（REPLIED_OK + REPLIED_NG）
  won: number; // 受注（DEAL）
};

/** パッケージごとの「送った・返ってきた・受注した」件数 */
export async function getPackageStats(ids: string[]): Promise<Record<string, PackageStats>> {
  const out: Record<string, PackageStats> = {};
  for (const id of ids) out[id] = { sent: 0, replied: 0, won: 0 };
  if (ids.length === 0) return out;

  const [sent, approaches] = await Promise.all([
    db.leadLog.groupBy({
      by: ["packageId"],
      where: { action: "FORM_SENT", packageId: { in: ids } },
      _count: { _all: true },
    }),
    db.salesApproach.groupBy({
      by: ["packageId", "result"],
      where: { packageId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  for (const r of sent) if (r.packageId && out[r.packageId]) out[r.packageId].sent = r._count._all;
  for (const r of approaches) {
    if (!r.packageId || !out[r.packageId]) continue;
    if (r.result === "DEAL") out[r.packageId].won += r._count._all;
    else if (r.result === "REPLIED_OK" || r.result === "REPLIED_NG") out[r.packageId].replied += r._count._all;
  }
  return out;
}

export async function listPackages(statuses?: SalesPackageStatus[]) {
  return db.salesPackage.findMany({
    where: statuses && statuses.length > 0 ? { status: { in: statuses } } : {},
    orderBy: [{ status: "asc" }, { category: "asc" }, { updatedAt: "desc" }],
    include: { proposedBy: { select: { name: true, email: true, groupCompany: { select: { name: true } } } } },
  });
}

export async function getPackageBySlug(slug: string) {
  return db.salesPackage.findUnique({
    where: { slug },
    include: { proposedBy: { select: { id: true, name: true, email: true, groupCompany: { select: { name: true } } } } },
  });
}

/** このパッケージで送った・結果が出た事例（一覧の下に出す） */
export async function getPackageApproaches(packageId: string, take = 8) {
  return db.salesApproach.findMany({
    where: { packageId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      industry: true,
      targetDesc: true,
      result: true,
      learnings: true,
      createdAt: true,
      groupCompany: { select: { name: true } },
    },
  });
}
