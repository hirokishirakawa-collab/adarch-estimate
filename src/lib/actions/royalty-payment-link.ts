"use server";

// ============================================================
// ロイヤリティ カード決済リンク（Square）— ADMIN専用
//   MF入力用一覧の各行（社×月・請求額税込）に対して Square Payment Link を1本作る。
//   金額が変わっていれば古いリンクをSquare側で削除して作り直す。
// ============================================================

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { createSquarePaymentLink, deleteSquarePaymentLink, isSquareConfigured } from "@/lib/square";
import { getMonthlyRoyaltyOverview } from "@/lib/actions/group-invoice";
import { invoiceTotals } from "@/lib/royalty-monthly";

const ROYALTY_PATH = "/dashboard/admin/royalty";

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月分`;
}

export async function getSquareConfigured(): Promise<boolean> {
  return isSquareConfigured();
}

/// 対象月の「要請求」全社（または指定社）に決済リンクを作る／金額が変わっていれば作り直す。
export async function ensureRoyaltyPaymentLinks(
  month: string,
  groupCompanyIds?: string[],
): Promise<{ error?: string; created: number; updated: number; skipped: number; errors: string[] }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません", created: 0, updated: 0, skipped: 0, errors: [] };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "対象月が不正です", created: 0, updated: 0, skipped: 0, errors: [] };
  if (!isSquareConfigured()) return { error: "Squareが未設定です（SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID）", created: 0, updated: 0, skipped: 0, errors: [] };

  const rows = (await getMonthlyRoyaltyOverview(month)).filter(
    (r) => !r.isExempt && !r.isCovered && r.shortfallExclTax > 0 && (!groupCompanyIds || groupCompanyIds.includes(r.groupCompanyId)),
  );
  const existing = await db.royaltyPaymentLink.findMany({ where: { month }, select: { groupCompanyId: true, amountInclTax: true, squareLinkId: true } });
  const existingByGc = new Map(existing.map((e) => [e.groupCompanyId, e]));

  let created = 0, updated = 0, skipped = 0;
  const errors: string[] = [];
  for (const r of rows) {
    const total = invoiceTotals(r.shortfallExclTax).totalInclTax;
    const prev = existingByGc.get(r.groupCompanyId);
    if (prev && prev.amountInclTax === total) { skipped++; continue; }

    const name = `ロイヤリティ ${monthLabel(month)} ${r.name}`;
    const note = `${r.name} ${monthLabel(month)} ロイヤリティ（税込¥${total.toLocaleString("ja-JP")}）`;
    const res = await createSquarePaymentLink({
      name,
      amountJpy: total,
      paymentNote: note,
      description: `アドアーチグループ ロイヤリティ ${monthLabel(month)}（${r.name}）\n税抜 ¥${r.shortfallExclTax.toLocaleString("ja-JP")} ＋ 消費税 ＝ 税込 ¥${total.toLocaleString("ja-JP")}`,
    });
    if (res.error || !res.link) { errors.push(`${r.name}: ${res.error ?? "不明なエラー"}`); continue; }

    if (prev) {
      // 旧リンクは金額違いなので閉じる（失敗しても新リンクは有効なので続行）
      const del = await deleteSquarePaymentLink(prev.squareLinkId);
      if (del.error) errors.push(`${r.name}: 旧リンク削除に失敗（${del.error}）`);
    }
    await db.royaltyPaymentLink.upsert({
      where: { groupCompanyId_month: { groupCompanyId: r.groupCompanyId, month } },
      create: { groupCompanyId: r.groupCompanyId, month, amountInclTax: total, name, squareLinkId: res.link.id, squareOrderId: res.link.orderId, url: res.link.url, longUrl: res.link.longUrl, createdById: info.userId },
      update: { amountInclTax: total, name, squareLinkId: res.link.id, squareOrderId: res.link.orderId, url: res.link.url, longUrl: res.link.longUrl, createdById: info.userId },
    });
    if (prev) updated++; else created++;
    logAudit({
      action: prev ? "royalty_payment_link_regenerated" : "royalty_payment_link_created",
      email: info.email,
      name: info.staffName,
      entity: "royalty_payment_link",
      entityId: `${r.groupCompanyId}:${month}`,
      detail: `${name} ¥${total.toLocaleString("ja-JP")} → ${res.link.url}`,
    });
  }

  revalidatePath(ROYALTY_PATH);
  return { created, updated, skipped, errors };
}

/// 決済リンクを削除（Square側も閉じる）。
export async function deleteRoyaltyPaymentLink(groupCompanyId: string, month: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };
  const row = await db.royaltyPaymentLink.findUnique({ where: { groupCompanyId_month: { groupCompanyId, month } } });
  if (!row) return {};
  const del = await deleteSquarePaymentLink(row.squareLinkId);
  if (del.error) return { error: del.error };
  await db.royaltyPaymentLink.delete({ where: { id: row.id } });
  logAudit({ action: "royalty_payment_link_deleted", email: info.email, name: info.staffName, entity: "royalty_payment_link", entityId: `${groupCompanyId}:${month}`, detail: `${row.name} を削除` });
  revalidatePath(ROYALTY_PATH);
  return {};
}
