"use server";

// ==============================================================
// パッケージ台帳 — 書き込み（起案・編集・承認・終了・削除）
//   権限:
//     起案（提案中）      … ログイン済みなら誰でも（各代表が「こんなパッケージが欲しい」を出す入口）
//     編集               … 本部は全部／起案者は自分の「提案中」だけ
//     承認・終了・復帰    … 本部だけ（稼働中＝売ってよい、の判断は本部）
//     削除               … 本部、または自分の「提案中」
// ==============================================================

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import type { SalesPackagePriceType, SalesPackageStatus } from "@/generated/prisma/client";
import { parseDeliverables, parseDocs, parseFulfillment, parseOptions, slugify } from "@/lib/packages/types";

type ActionState = { error?: string } | null;

function str(fd: FormData, key: string, max = 4000): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function intOrNull(fd: FormData, key: string): number | null {
  const v = str(fd, key, 20).replace(/[,¥￥\s]/g, "");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
function json(fd: FormData, key: string): unknown {
  const v = str(fd, key, 20000);
  if (!v) return [];
  try {
    return JSON.parse(v);
  } catch {
    return [];
  }
}
function priceType(v: string): SalesPackagePriceType {
  return v === "MONTHLY" || v === "INITIAL_PLUS_MONTHLY" ? v : "ONE_TIME";
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base);
  for (let i = 0; i < 20; i++) {
    const hit = await db.salesPackage.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${slugify(base).slice(0, 34)}-${i + 2}`;
  }
  return `${slugify(base).slice(0, 30)}-${Date.now().toString(36)}`;
}

function revalidate(slug?: string) {
  revalidatePath("/dashboard/packages");
  if (slug) revalidatePath(`/dashboard/packages/${slug}`);
  revalidatePath("/dashboard/leads/outreach");
}

// ---------------------------------------------------------------
// 起案・編集（1つのフォームから。id があれば更新）
// ---------------------------------------------------------------
export async function savePackage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const isAdmin = info.role === "ADMIN";

  const id = str(fd, "id", 64) || null;
  const name = str(fd, "name", 80);
  if (!name) return { error: "パッケージ名は必須です" };
  const category = str(fd, "category", 40) || "その他";

  const existing = id ? await db.salesPackage.findUnique({ where: { id } }) : null;
  if (id && !existing) return { error: "パッケージが見つかりません" };
  if (existing && !isAdmin) {
    if (existing.proposedById !== info.userId || existing.status !== "PROPOSED") {
      return { error: "稼働中・終了のパッケージ、他の方の起案は本部だけが編集できます" };
    }
  }

  const slugInput = str(fd, "slug", 40);
  const slug = await uniqueSlug(slugInput || name, existing?.id);

  // 状態は本部だけが動かせる。起案は必ず「提案中」
  const statusInput = str(fd, "status", 20) as SalesPackageStatus;
  const status: SalesPackageStatus = isAdmin && ["PROPOSED", "ACTIVE", "RETIRED"].includes(statusInput)
    ? statusInput
    : existing?.status ?? "PROPOSED";

  const data = {
    slug,
    name,
    tagline: str(fd, "tagline", 80) || null,
    category,
    targetIndustries: str(fd, "targetIndustries", 400)
      .split(/[,、\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 20),
    painPoints: str(fd, "painPoints") || null,
    summary: str(fd, "summary") || null,
    deliverables: parseDeliverables(json(fd, "deliverables")),
    leadTime: str(fd, "leadTime", 80) || null,
    options: parseOptions(json(fd, "options")),
    priceType: priceType(str(fd, "priceType", 30)),
    initialPrice: intOrNull(fd, "initialPrice"),
    monthlyPrice: intOrNull(fd, "monthlyPrice"),
    priceNote: str(fd, "priceNote", 200) || null,
    fulfillment: parseFulfillment(json(fd, "fulfillment")),
    pitchText: str(fd, "pitchText") || null,
    talkTrack: str(fd, "talkTrack") || null,
    rules: str(fd, "rules") || null,
    caseStudies: str(fd, "caseStudies") || null,
    docs: parseDocs(json(fd, "docs")),
    proposalNote: str(fd, "proposalNote") || null,
    status,
    approvedAt: status === "ACTIVE" ? existing?.approvedAt ?? new Date() : existing?.approvedAt ?? null,
    retiredAt: status === "RETIRED" ? existing?.retiredAt ?? new Date() : null,
  };

  let outSlug = slug;
  try {
    if (existing) {
      await db.salesPackage.update({ where: { id: existing.id }, data });
      logAudit({ action: "package_updated", email: info.email, name: info.staffName, entity: "sales_package", entityId: existing.id, detail: name });
    } else {
      const created = await db.salesPackage.create({ data: { ...data, proposedById: info.userId } });
      outSlug = created.slug;
      logAudit({ action: "package_proposed", email: info.email, name: info.staffName, entity: "sales_package", entityId: created.id, detail: name });
    }
  } catch (e) {
    console.error("[savePackage]", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidate(outSlug);
  if (existing && existing.slug !== outSlug) revalidatePath(`/dashboard/packages/${existing.slug}`);
  redirect(`/dashboard/packages/${outSlug}`);
}

// ---------------------------------------------------------------
// 状態を動かす（本部だけ）: 提案中 → 稼働中 → 終了 → 稼働中（復帰）
// ---------------------------------------------------------------
export async function setPackageStatus(id: string, status: SalesPackageStatus): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "承認・終了は本部だけが行えます" };
  if (!["PROPOSED", "ACTIVE", "RETIRED"].includes(status)) return { error: "状態の指定が不正です" };

  const pkg = await db.salesPackage.findUnique({ where: { id }, select: { id: true, slug: true, name: true, approvedAt: true } });
  if (!pkg) return { error: "パッケージが見つかりません" };

  await db.salesPackage.update({
    where: { id },
    data: {
      status,
      approvedAt: status === "ACTIVE" ? pkg.approvedAt ?? new Date() : pkg.approvedAt,
      retiredAt: status === "RETIRED" ? new Date() : null,
    },
  });
  logAudit({ action: `package_status_${status.toLowerCase()}`, email: info.email, name: info.staffName, entity: "sales_package", entityId: id, detail: pkg.name });
  revalidate(pkg.slug);
  return {};
}

// ---------------------------------------------------------------
// 削除（本部、または自分の提案中）。送付・事例の紐づけは SetNull で残る
// ---------------------------------------------------------------
export async function deletePackage(id: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const pkg = await db.salesPackage.findUnique({ where: { id }, select: { id: true, slug: true, name: true, status: true, proposedById: true } });
  if (!pkg) return { error: "パッケージが見つかりません" };
  const mine = pkg.proposedById === info.userId && pkg.status === "PROPOSED";
  if (info.role !== "ADMIN" && !mine) return { error: "削除できるのは本部、または自分の提案中のものだけです" };

  await db.salesPackage.delete({ where: { id } });
  logAudit({ action: "package_deleted", email: info.email, name: info.staffName, entity: "sales_package", entityId: id, detail: pkg.name });
  revalidate(pkg.slug);
  redirect("/dashboard/packages");
}
