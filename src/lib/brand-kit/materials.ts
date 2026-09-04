// ==============================================================
// ブランドキット — 見ている人向けの材料一式を組む（サーバー専用）
// ==============================================================

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { buildPackageMaterial, type MaterialSender } from "./material";
import { getGroupDataSummary } from "./group-data";
import { MEDIA, getMedium } from "@/lib/media";
import { buildMediumMaterial } from "./medium-material";

export interface KitMaterialItem {
  id: string;
  label: string;
  note: string;
  version: string;
  body: string;
  downloadHref: string;
  group: "static" | "package" | "media";
}

export async function resolveViewer(email: string) {
  const me = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      groupCompanyId: true,
      groupCompany: { select: { name: true, ownerName: true, prefecture: true, websiteUrl: true } },
    },
  });
  if (!me) return null;
  const sender: MaterialSender | null = me.groupCompany
    ? { company: me.groupCompany.name, person: me.groupCompany.ownerName, prefecture: me.groupCompany.prefecture, website: me.groupCompany.websiteUrl, email }
    : null;
  return { ...me, sender };
}

export async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** 稼働中パッケージ全部の材料（ブランドキットのタブ用） */
export async function buildPackageMaterials(email: string): Promise<KitMaterialItem[]> {
  const me = await resolveViewer(email);
  if (!me) return [];
  const [pkgs, guidelines, root] = await Promise.all([
    db.salesPackage.findMany({ where: { status: "ACTIVE" }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.salesGuideline.findMany({ where: { key: "prohibited" } }),
    baseUrl(),
  ]);
  const prohibited = guidelines[0]?.value;
  const from = me.groupCompanyId ? `?from=${me.groupCompanyId}` : "";
  const items: KitMaterialItem[] = [];
  for (const pkg of pkgs) {
    const groupData = await getGroupDataSummary(pkg.id);
    const body = buildPackageMaterial({
      pkg,
      sender: me.sender,
      publicUrl: `${root}/p/${pkg.slug}${from}`,
      feedbackUrl: `${root}/feedback/${pkg.slug}${from}`,
      groupData,
      prohibited,
    });
    items.push({
      id: `pkg-${pkg.slug}`,
      label: pkg.name,
      note: `${pkg.category}${pkg.tagline ? `／${pkg.tagline}` : ""}`,
      version: `OSから自動生成（${new Date().toLocaleDateString("ja-JP")}）`,
      body,
      downloadHref: `/api/brand-kit/material/${pkg.slug}`,
      group: "package",
    });
  }
  return items;
}

/** 1件だけ（パッケージ詳細のコピー用・API用） */
export async function buildOnePackageMaterial(email: string, slug: string): Promise<string | null> {
  const me = await resolveViewer(email);
  if (!me) return null;
  const pkg = await db.salesPackage.findUnique({ where: { slug } });
  if (!pkg) return null;
  if (pkg.status !== "ACTIVE" && me.role !== "ADMIN") return null;
  const [guidelines, root, groupData] = await Promise.all([
    db.salesGuideline.findMany({ where: { key: "prohibited" } }),
    baseUrl(),
    getGroupDataSummary(pkg.id),
  ]);
  const from = me.groupCompanyId ? `?from=${me.groupCompanyId}` : "";
  return buildPackageMaterial({
    pkg,
    sender: me.sender,
    publicUrl: `${root}/p/${pkg.slug}${from}`,
    feedbackUrl: `${root}/feedback/${pkg.slug}${from}`,
    groupData,
    prohibited: guidelines[0]?.value,
  });
}

/** 媒体メニュー全部の材料（ブランドキットのタブ用） */
export async function buildMediaMaterials(email: string): Promise<KitMaterialItem[]> {
  const me = await resolveViewer(email);
  if (!me) return [];
  const [root, groupData] = await Promise.all([baseUrl(), getGroupDataSummary()]);
  return MEDIA.map((medium) => ({
    id: `media-${medium.id}`,
    label: medium.name,
    note: medium.short,
    version: `OSから自動生成（${new Date().toLocaleDateString("ja-JP")}）`,
    body: buildMediumMaterial({ medium, sender: me.sender, simulatorUrl: `${root}${medium.simulatorPath}`, groupData }),
    downloadHref: `/api/brand-kit/media/${medium.id}`,
    group: "media" as const,
  }));
}

/** 媒体1件だけ（API用） */
export async function buildOneMediumMaterial(email: string, id: string): Promise<string | null> {
  const medium = getMedium(id);
  if (!medium) return null;
  const me = await resolveViewer(email);
  if (!me) return null;
  const [root, groupData] = await Promise.all([baseUrl(), getGroupDataSummary()]);
  return buildMediumMaterial({ medium, sender: me.sender, simulatorUrl: `${root}${medium.simulatorPath}`, groupData });
}
