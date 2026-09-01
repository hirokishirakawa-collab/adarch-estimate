"use server";

// ============================================================
// ロイヤリティ入金チェック（本部ADMIN専用台帳）
//
// 実際の徴収はOS外（外部請求書＋銀行/Square/GMO）で行われるため、
// 「社×月」で本部が入金を確認した事実だけを RoyaltyPaymentCheck に残す。
// 相殺済み／免除／期限超過はロイヤリティ判定（請求申請の10%）から自動で導く。
// パートナーには一切見せない（全関数 ADMIN 限定）。
// ============================================================

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  commissionOf,
  evaluatePartnerRoyalty,
  invoiceTotals,
  resolveEffectiveCommission,
  royaltyDueDateOf,
} from "@/lib/royalty-monthly";
import { fetchReportedRevenue } from "@/lib/royalty-revenue";
import type { RoyaltyPaymentMethod } from "@/generated/prisma/client";

const CHECK_PATH = "/dashboard/admin/royalty/check";

export type RoyaltyCellStatus =
  | "PAID" // 本部が入金を確認済み（手動記録あり）
  | "OFFSET" // 相殺済み＝案件10%で最低保証クリア（支払不要・自動）
  | "EXEMPT" // 免除（恒久 or 当月・自動）
  | "OVERDUE" // 期限超過・未入金（自動）
  | "PENDING" // 期限前・未確認
  | "FUTURE"; // 対象月が未到来（判定しない）

export type RoyaltyCheckRecord = {
  paidOn: string; // ISO 日付
  method: RoyaltyPaymentMethod;
  amountInclTax: number | null;
  note: string | null;
};

export type RoyaltyCheckCell = {
  month: string;
  status: RoyaltyCellStatus;
  dueDate: string; // ISO 日付
  expectedInclTax: number; // 未入金なら請求見込み（税込）。相殺/免除は0
  shortfallExclTax: number;
  revenueExclTax: number; // 月次報告の売上（税抜）
  royaltyExclTax: number; // ロイヤリティ = max(最低保証, 売上×10%, 手数料)（税抜）
  commissionExclTax: number; // 当月の手数料（10%・税抜）＝相殺
  check: RoyaltyCheckRecord | null;
};

export type RoyaltyCheckRow = {
  groupCompanyId: string;
  name: string;
  ownerName: string;
  isExemptPermanent: boolean;
  cells: RoyaltyCheckCell[]; // 12ヶ月（1月→12月）
};

export type RoyaltyYearCheck = {
  year: number;
  months: { month: string; dueDate: string }[];
  rows: RoyaltyCheckRow[];
  /// 期限が到来している中で最新の対象月（サマリー用）。年内に該当なしなら null
  latestDueMonth: string | null;
};

/// 日付だけを扱う（タイムゾーンで前日にずれないよう、保存は UTC 0時・表示は UTC の年月日）
function isoDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
/// 期限などローカル日付として作った Date を YYYY-MM-DD に
function isoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/// 今日（日本時間）を YYYY-MM-DD で。サーバーがUTCでも日本の日付で期限判定する
function todayKeyJst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

/// 年間の入金チェック表を組み立てる（ADMIN専用）。
export async function getRoyaltyYearCheck(year: number): Promise<RoyaltyYearCheck | null> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return null;

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const todayKey = todayKeyJst();
  const currentMonth = todayKey.slice(0, 7);

  // 本部自身（ADMINユーザーが紐づく社）はロイヤリティの対象外＝行に出さない
  const partners = await db.groupCompany.findMany({
    where: { isActive: true, linkedUsers: { none: { role: "ADMIN" } } },
    select: { id: true, name: true, ownerName: true, branchLabels: true, royaltyMinExclTax: true, royaltyExempt: true },
    orderBy: { name: "asc" },
  });

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const [requests, adjustments, checks, revenueMap] = await Promise.all([
    db.invoiceRequest.findMany({
      where: { status: { not: "DRAFT" }, billingDate: { gte: yearStart, lt: yearEnd } },
      select: {
        kind: true,
        amountExclTax: true,
        commissionRate: true,
        commissionExclTax: true,
        branchLabel: true,
        billingDate: true,
        createdBy: { select: { groupCompanyId: true } },
      },
    }),
    db.royaltyAdjustment.findMany({
      where: { month: { startsWith: `${year}-` } },
      select: { groupCompanyId: true, month: true, branchLabel: true, commissionExclTax: true, exempt: true },
    }),
    db.royaltyPaymentCheck.findMany({
      where: { month: { startsWith: `${year}-` } },
      select: { groupCompanyId: true, month: true, paidOn: true, method: true, amountInclTax: true, note: true },
    }),
    fetchReportedRevenue({
      from: yearStart,
      to: yearEnd,
      branchLabelsByCompany: new Map(partners.map((p) => [p.id, (p.branchLabels ?? []).filter(Boolean)])),
    }),
  ]);

  // 自動集計（getMonthlyRoyaltyOverview と同じ規則）: key = `${groupCompanyId}:${month}`
  const autoTotal = new Map<string, number>();
  const autoByLabel = new Map<string, Record<string, number>>();
  for (const r of requests) {
    const gc = r.createdBy?.groupCompanyId;
    if (!gc) continue;
    const d = new Date(r.billingDate);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const key = `${gc}:${month}`;
    const commission =
      r.commissionExclTax != null
        ? Math.max(0, Number(r.commissionExclTax))
        : r.kind === "MEDIA"
          ? 0
          : commissionOf(Number(r.amountExclTax), Number(r.commissionRate));
    autoTotal.set(key, (autoTotal.get(key) ?? 0) + commission);
    if (r.branchLabel) {
      const m = autoByLabel.get(key) ?? {};
      m[r.branchLabel] = (m[r.branchLabel] ?? 0) + commission;
      autoByLabel.set(key, m);
    }
  }

  const overrides = new Map<string, Record<string, number>>();
  const monthExempt = new Set<string>();
  for (const a of adjustments) {
    const key = `${a.groupCompanyId}:${a.month}`;
    if (a.branchLabel === "" && a.exempt) monthExempt.add(key);
    const m = overrides.get(key) ?? {};
    m[a.branchLabel] = a.commissionExclTax;
    overrides.set(key, m);
  }

  const checkMap = new Map<string, RoyaltyCheckRecord>();
  for (const c of checks) {
    checkMap.set(`${c.groupCompanyId}:${c.month}`, {
      paidOn: isoDateUtc(new Date(c.paidOn)),
      method: c.method,
      amountInclTax: c.amountInclTax,
      note: c.note,
    });
  }

  const monthMeta = months.map((month) => ({ month, dueDate: isoDateLocal(royaltyDueDateOf(month)) }));
  const latestDueMonth = [...monthMeta].reverse().find((m) => m.dueDate <= todayKey)?.month ?? null;

  const rows: RoyaltyCheckRow[] = partners.map((p) => {
    const labels = (p.branchLabels ?? []).filter(Boolean);
    const cells: RoyaltyCheckCell[] = monthMeta.map(({ month, dueDate }) => {
      const key = `${p.id}:${month}`;
      const { commissionByLabel, total } = resolveEffectiveCommission({
        branchLabels: labels,
        autoByLabel: autoByLabel.get(key) ?? {},
        autoTotal: autoTotal.get(key) ?? 0,
        overrides: overrides.get(key) ?? {},
      });
      const isMonthExempt = monthExempt.has(key);
      const rev = revenueMap.get(key);
      const evald = evaluatePartnerRoyalty({
        branchLabels: p.branchLabels,
        commissionByLabel,
        totalCommissionExclTax: total,
        revenueByLabel: rev?.byLabel,
        totalRevenueExclTax: rev?.total,
        minExclTax: p.royaltyMinExclTax ?? undefined,
        exempt: p.royaltyExempt || isMonthExempt,
      });
      const check = checkMap.get(key) ?? null;

      let status: RoyaltyCellStatus;
      if (check) status = "PAID";
      else if (evald.isExempt) status = "EXEMPT";
      else if (month > currentMonth) status = "FUTURE";
      else if (evald.isCovered) status = "OFFSET";
      else if (dueDate < todayKey) status = "OVERDUE";
      else status = "PENDING";

      const expected = status === "OVERDUE" || status === "PENDING" ? invoiceTotals(evald.shortfallExclTax).totalInclTax : 0;
      return {
        month,
        status,
        dueDate,
        expectedInclTax: expected,
        shortfallExclTax: evald.shortfallExclTax,
        revenueExclTax: evald.revenueExclTax,
        royaltyExclTax: evald.royaltyExclTax,
        commissionExclTax: evald.commissionTotalExclTax,
        check,
      };
    });
    return { groupCompanyId: p.id, name: p.name, ownerName: p.ownerName, isExemptPermanent: p.royaltyExempt, cells };
  });

  return { year, months: monthMeta, rows, latestDueMonth };
}

// ---------------------------------------------------------------
// 入金を記録（upsert）／取り消し
// ---------------------------------------------------------------
export async function setRoyaltyPaymentCheck(input: {
  groupCompanyId: string;
  month: string;
  paidOn: string; // "YYYY-MM-DD"
  method: RoyaltyPaymentMethod;
  amountInclTax: number | null;
  note: string | null;
}): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };
  if (!/^\d{4}-\d{2}$/.test(input.month)) return { error: "対象月が不正です" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) return { error: "入金日が不正です" };
  const [y, m, d] = input.paidOn.split("-").map(Number);
  const paidOn = new Date(Date.UTC(y, m - 1, d)); // 日付だけ（UTC 0時）
  if (Number.isNaN(paidOn.getTime())) return { error: "入金日が不正です" };
  const amount = input.amountInclTax == null || Number.isNaN(input.amountInclTax) ? null : Math.max(0, Math.round(input.amountInclTax));
  const note = (input.note ?? "").trim() || null;

  const partner = await db.groupCompany.findUnique({ where: { id: input.groupCompanyId }, select: { name: true } });
  if (!partner) return { error: "パートナーが見つかりません" };

  try {
    await db.royaltyPaymentCheck.upsert({
      where: { groupCompanyId_month: { groupCompanyId: input.groupCompanyId, month: input.month } },
      create: { groupCompanyId: input.groupCompanyId, month: input.month, paidOn, method: input.method, amountInclTax: amount, note, checkedById: info.userId },
      update: { paidOn, method: input.method, amountInclTax: amount, note, checkedById: info.userId },
    });
    logAudit({
      action: "royalty_payment_check_set",
      email: info.email,
      name: info.staffName,
      entity: "royalty_payment_check",
      entityId: `${input.groupCompanyId}:${input.month}`,
      detail: `${partner.name} ${input.month}分 入金記録（${input.paidOn}・${input.method}${amount != null ? `・¥${amount.toLocaleString("ja-JP")}` : ""}）`,
    });
  } catch (e) {
    console.error("[setRoyaltyPaymentCheck] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }
  revalidatePath(CHECK_PATH);
  return {};
}

export async function clearRoyaltyPaymentCheck(groupCompanyId: string, month: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "対象月が不正です" };
  try {
    await db.royaltyPaymentCheck.deleteMany({ where: { groupCompanyId, month } });
    logAudit({
      action: "royalty_payment_check_clear",
      email: info.email,
      name: info.staffName,
      entity: "royalty_payment_check",
      entityId: `${groupCompanyId}:${month}`,
      detail: `${month}分 入金記録を取り消し`,
    });
  } catch (e) {
    console.error("[clearRoyaltyPaymentCheck] DB error:", e instanceof Error ? e.message : e);
    return { error: "取り消しに失敗しました" };
  }
  revalidatePath(CHECK_PATH);
  return {};
}
