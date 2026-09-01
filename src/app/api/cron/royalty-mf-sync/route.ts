import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { syncRoyaltyMfPayments, syncInvoiceRequestMfPayments } from "@/lib/royalty-mf-sync";

export const maxDuration = 300;
const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * 毎朝: MFクラウド請求書の入金状況を取り込む（GitHub Actions から）
 *   - ロイヤリティ請求書 → 入金チェック台帳に✅
 *   - 請求申請（MF作成済・未払い）→ 支払済み
 * Headers: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, email: true } });
  if (!admin) return NextResponse.json({ error: "ADMIN user not found" }, { status: 500 });

  const royalty = await syncRoyaltyMfPayments({ actorUserId: admin.id });
  const requests = await syncInvoiceRequestMfPayments();
  logAudit({ action: "royalty_mf_payment_synced_cron", email: admin.email, name: "cron", entity: "royalty_mf_billing", entityId: "all", detail: `ロイヤリティ: 確認${royalty.checked}・入金済${royalty.paid}・新規✅${royalty.newlyMarked} / 請求申請: 確認${requests.checked}・支払済${requests.newlyMarked}${royalty.errors.length + requests.errors.length ? ` / エラー ${[...royalty.errors, ...requests.errors].join(" | ").slice(0, 500)}` : ""}` });
  return NextResponse.json({ ok: true, royalty, requests });
}
