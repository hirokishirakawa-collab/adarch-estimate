import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ---------------------------------------------------------------
// POST /api/leads/outreach/sent
//   営業フォーム（OS内）で「送付済み」にした履歴をOSへ反映する。
//   - LeadLog に action="FORM_SENT" として、使った訴求＋本文を記録
//   - リードが UNTOUCHED の場合のみ CALLED に更新（ステータスは降格しない）
//   body: { leadId: string; appeal?: string; body?: string; action: "mark" | "unmark" }
// ---------------------------------------------------------------
const FORM_SENT = "FORM_SENT";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { leadId?: string; appeal?: string; body?: string; action?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId, appeal, body, action } = payload;
  if (typeof leadId !== "string" || !leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // 送付済み解除 → 直近の送付ログを1件削除（ステータスは戻さない）
  if (action === "unmark") {
    const last = await db.leadLog.findFirst({
      where: { leadId, action: FORM_SENT },
      orderBy: { createdAt: "desc" },
    });
    if (last) {
      await db.leadLog.delete({ where: { id: last.id } });
    }
    return NextResponse.json({ ok: true, status: lead.status });
  }

  // 送付済み登録
  const staffName = user.name ?? session.user.email;
  const appealText = typeof appeal === "string" ? appeal : "";
  const bodyText = typeof body === "string" ? body : "";
  const detail = `【訴求】${appealText}\n${bodyText}`.slice(0, 8000);

  await db.leadLog.create({
    data: { action: FORM_SENT, detail, staffName, leadId },
  });

  let status = lead.status;
  if (lead.status === "UNTOUCHED") {
    await db.lead.update({ where: { id: leadId }, data: { status: "CALLED" } });
    status = "CALLED";
  }

  return NextResponse.json({ ok: true, status });
}
