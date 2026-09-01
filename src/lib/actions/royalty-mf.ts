"use server";

// ============================================================
// ロイヤリティ請求書をMFクラウド請求書に作成／入金状況を取り込む（ADMIN専用）
//   - 請求書の正本はMF。OSは金額（ロイヤリティ状況）を渡すだけ
//   - 備考(note)にその社・その月のSquare決済リンクを書き込む
//   - MFの入金済み(payment_status=2)は入金チェック台帳に✅として取り込む
// ============================================================

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { getMonthlyRoyaltyOverview } from "@/lib/actions/group-invoice";
import { invoiceTotals, royaltyDueDateOf } from "@/lib/royalty-monthly";
import { isMfConfigured, mfCreateBilling, mfCreatePartner, mfGetBilling, mfGetPartner, mfIsConnected, mfNormalizeName, mfSearchPartners, mfDisconnect } from "@/lib/mf-invoice";

const ROYALTY_PATH = "/dashboard/admin/royalty";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayJst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月分`;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/// MFの payment_status は数値("0".."4")でも日本語ラベルでも返るため両対応で 0〜4 に正規化
const MF_PAY_LABELS: Record<string, number> = { "未設定": 0, "未入金": 1, "入金済み": 2, "入金済": 2, "未払い": 3, "振込済み": 4, "振込済": 4 };
function parsePayStatus(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return Number(s);
  return MF_PAY_LABELS[s] ?? null;
}

export type MfStatus = { configured: boolean; connected: boolean };
export async function getMfStatus(): Promise<MfStatus> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { configured: false, connected: false };
  return { configured: isMfConfigured(), connected: await mfIsConnected() };
}

export async function disconnectMf(): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return { error: "権限がありません" };
  await mfDisconnect();
  logAudit({ action: "mf_disconnected", email: info.email, name: info.staffName, entity: "mf_connection", entityId: "default", detail: "MF接続を解除" });
  revalidatePath(ROYALTY_PATH);
  return {};
}

/// MFの取引先（部署ID）を解決。GroupCompany に保存済みならそれ、無ければ名前で検索→無ければ作成。
async function resolveDepartmentId(gc: { id: string; name: string; ownerName: string; registeredName: string | null; mfPartnerName: string | null; mfDepartmentId: string | null }, email: string | null): Promise<{ departmentId: string; created: boolean }> {
  if (gc.mfDepartmentId) return { departmentId: gc.mfDepartmentId, created: false };
  // 検索は「姓」など短い語でも当てる（MF側は「宮本　貴史」のように全角スペース入りのことがある）
  const candidates = [gc.mfPartnerName, gc.registeredName, gc.ownerName, gc.ownerName?.split(/[\s\u3000]/)[0]].filter((v): v is string => !!v && v.trim().length > 0);
  for (const nm of candidates) {
    const found = await mfSearchPartners(nm.trim());
    const wanted = [gc.mfPartnerName, gc.registeredName, gc.ownerName].filter((v): v is string => !!v).map(mfNormalizeName);
    const exact = found.find((p) => wanted.includes(mfNormalizeName(p.name))) ?? (found.length === 1 && nm !== gc.ownerName?.split(/[\s\u3000]/)[0] ? found[0] : undefined);
    if (exact) {
      const partner = exact.departments?.length ? exact : await mfGetPartner(exact.id);
      const dep = partner.departments?.[0];
      if (dep?.id) {
        await db.groupCompany.update({ where: { id: gc.id }, data: { mfPartnerId: partner.id, mfDepartmentId: dep.id, mfPartnerName: partner.name } });
        return { departmentId: dep.id, created: false };
      }
    }
  }
  const name = gc.mfPartnerName ?? gc.registeredName ?? gc.ownerName;
  const created = await mfCreatePartner({ name, personName: gc.ownerName, email });
  const dep = created.departments?.[0];
  if (!dep?.id) throw new Error(`MF取引先を作成しましたが部署IDが取れません（${name}）`);
  await db.groupCompany.update({ where: { id: gc.id }, data: { mfPartnerId: created.id, mfDepartmentId: dep.id, mfPartnerName: created.name } });
  return { departmentId: dep.id, created: true };
}

/// 対象月の「要請求」全社にMF請求書を作成（既に作成済みの社はスキップ）。
export async function createMfBillingsForMonth(month: string, billingDate?: string, groupCompanyIds?: string[]): Promise<{ error?: string; created: number; skipped: number; partnersCreated: number; errors: string[] }> {
  const info = await getSessionInfo();
  const zero = { created: 0, skipped: 0, partnersCreated: 0, errors: [] as string[] };
  if (!info || info.role !== "ADMIN") return { error: "権限がありません", ...zero };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "対象月が不正です", ...zero };
  if (billingDate && !/^\d{4}-\d{2}-\d{2}$/.test(billingDate)) return { error: "請求日が不正です", ...zero };
  if (!isMfConfigured()) return { error: "MF_CLIENT_ID / MF_CLIENT_SECRET が未設定です", ...zero };
  if (!(await mfIsConnected())) return { error: "MF未接続です（「MFに接続」から承認してください）", ...zero };

  const rows = (await getMonthlyRoyaltyOverview(month)).filter(
    (r) => !r.isExempt && !r.isCovered && r.shortfallExclTax > 0 && (!groupCompanyIds || groupCompanyIds.includes(r.groupCompanyId)),
  );
  const existing = new Set((await db.royaltyMfBilling.findMany({ where: { month }, select: { groupCompanyId: true } })).map((e) => e.groupCompanyId));
  const links = new Map((await db.royaltyPaymentLink.findMany({ where: { month }, select: { groupCompanyId: true, url: true, amountInclTax: true } })).map((l) => [l.groupCompanyId, l]));
  const companies = new Map((await db.groupCompany.findMany({
    where: { id: { in: rows.map((r) => r.groupCompanyId) } },
    select: { id: true, name: true, ownerName: true, registeredName: true, mfPartnerName: true, mfDepartmentId: true, linkedUsers: { select: { email: true, isActive: true }, orderBy: { createdAt: "asc" } } },
  })).map((c) => [c.id, c]));

  const due = ymd(royaltyDueDateOf(month));
  const today = billingDate || todayJst(); // 請求日（指定がなければ今日・日本時間）
  if (today > due) return { error: `請求日（${today}）が支払期限（${due}）より後です`, ...zero };
  const label = monthLabel(month);
  let created = 0, skipped = 0, partnersCreated = 0;
  const errors: string[] = [];

  for (const r of rows) {
    if (existing.has(r.groupCompanyId)) { skipped++; continue; }
    const gc = companies.get(r.groupCompanyId);
    if (!gc) { errors.push(`${r.name}: 会社情報なし`); continue; }
    try {
      const email = gc.linkedUsers.find((u) => u.isActive)?.email ?? gc.linkedUsers[0]?.email ?? null;
      const dep = await resolveDepartmentId(gc, email);
      if (dep.created) partnersCreated++;

      const totals = invoiceTotals(r.shortfallExclTax);
      const link = links.get(r.groupCompanyId);
      const linkLine = link && link.amountInclTax === totals.totalInclTax
        ? [
            `■ カード払い（Square）はこちら: ${link.url}`,
            `　※このリンクは本請求書（${r.name}様・${label}）専用です。他の方・他の月のお支払いには使えません`,
            `　※今回のご請求限りのリンクです。次回以降は毎回新しいリンクをご案内します`,
          ].join("\n")
        : `■ カード払い（Square）リンクは別途ご案内します`;
      // 備考は詳細を書かない。金額は明細欄が正＝備考には根拠（OSの月次報告）と支払方法だけ（代表指示 2026-09-01）
      const note = [
        `アドアーチグループ ロイヤリティ ${label}`,
        `金額は Ad Arch OS にご報告いただいた月次報告（売上）に基づいて算定しています。`,
        "",
        linkLine,
        "■ お振込の場合は本請求書記載の口座へお願いいたします（振込手数料はご負担ください）",
      ].join("\n");

      const items = r.branches.length > 0
        ? r.branches.filter((b) => b.shortfallExclTax > 0).map((b) => ({ name: `月額ロイヤリティ（${b.label}・${label}）`, price: b.shortfallExclTax, quantity: 1 }))
        : [{ name: `月額ロイヤリティ（${label}）`, price: totals.subtotalExclTax, quantity: 1 }];
      // 県未指定の相殺などで県別合計と請求額がズレる場合は1行にまとめる
      if (items.reduce((s, it) => s + it.price, 0) !== totals.subtotalExclTax) {
        items.splice(0, items.length, { name: `月額ロイヤリティ（${label}）`, price: totals.subtotalExclTax, quantity: 1 });
      }

      const b = await mfCreateBilling({
        departmentId: dep.departmentId,
        billingDate: today,
        dueDate: due,
        title: `アドアーチグループ ロイヤリティ ${label}`,
        note,
        memo: `OS自動作成 ${todayJst()} / ${r.name}`,
        items,
      });
      await db.royaltyMfBilling.create({
        data: { groupCompanyId: r.groupCompanyId, month, mfBillingId: b.id, billingNumber: b.billing_number ?? null, pdfUrl: b.pdf_url ?? null, totalInclTax: totals.totalInclTax, paymentStatus: parsePayStatus(b.payment_status), createdById: info.userId },
      });
      created++;
      logAudit({ action: "royalty_mf_billing_created", email: info.email, name: info.staffName, entity: "royalty_mf_billing", entityId: `${r.groupCompanyId}:${month}`, detail: `${r.name} ${label} MF請求書 ${b.billing_number ?? b.id} ¥${totals.totalInclTax.toLocaleString("ja-JP")}` });
      await sleep(700); // 作成系は1秒3回まで（検索・取引先作成も含むため余裕を持つ）
    } catch (e) {
      errors.push(`${r.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  revalidatePath(ROYALTY_PATH);
  return { created, skipped, partnersCreated, errors };
}

/// MFの入金状況を取り込み、入金済み(2)は入金チェック台帳に✅（未記録のみ）。
export async function syncMfPaymentStatus(month: string): Promise<{ error?: string; checked: number; paid: number; newlyMarked: number; errors: string[] }> {
  const info = await getSessionInfo();
  const zero = { checked: 0, paid: 0, newlyMarked: 0, errors: [] as string[] };
  if (!info || info.role !== "ADMIN") return { error: "権限がありません", ...zero };
  if (!(await mfIsConnected())) return { error: "MF未接続です", ...zero };

  const billings = await db.royaltyMfBilling.findMany({ where: { month }, include: { groupCompany: { select: { name: true } } } });
  let checked = 0, paid = 0, newlyMarked = 0;
  const errors: string[] = [];
  for (const b of billings) {
    try {
      const mb = await mfGetBilling(b.mfBillingId);
      const st = parsePayStatus(mb.payment_status);
      await db.royaltyMfBilling.update({ where: { id: b.id }, data: { paymentStatus: st, syncedAt: new Date(), billingNumber: mb.billing_number ?? b.billingNumber, pdfUrl: mb.pdf_url ?? b.pdfUrl } });
      checked++;
      if (st === 2) {
        paid++;
        const exists = await db.royaltyPaymentCheck.findUnique({ where: { groupCompanyId_month: { groupCompanyId: b.groupCompanyId, month } } });
        if (!exists) {
          const [y, m, d] = todayJst().split("-").map(Number);
          await db.royaltyPaymentCheck.create({ data: { groupCompanyId: b.groupCompanyId, month, paidOn: new Date(Date.UTC(y, m - 1, d)), method: "OTHER", amountInclTax: b.totalInclTax, note: `MFで入金済み（請求書 ${mb.billing_number ?? b.mfBillingId}）。入金日はMFで確認`, checkedById: info.userId } });
          newlyMarked++;
        }
      }
      await sleep(150);
    } catch (e) {
      errors.push(`${b.groupCompany.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  revalidatePath(ROYALTY_PATH);
  revalidatePath("/dashboard/admin/royalty/check");
  logAudit({ action: "royalty_mf_payment_synced", email: info.email, name: info.staffName, entity: "royalty_mf_billing", entityId: month, detail: `MF入金状況取込 ${month}: 確認${checked}・入金済${paid}・新規✅${newlyMarked}` });
  return { checked, paid, newlyMarked, errors };
}
