import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  FORM_SKIPPED,
  OUTREACH_SKIP_REASONS,
  type OutreachSkipReasonValue,
  getOutreachSkipReason,
  buildSkipDetail,
  parseSkipDetail,
  buildSkipMemoLine,
  appendSkipMemo,
  removeSkipMemo,
} from "@/lib/constants/outreach-skip";

// ---------------------------------------------------------------
// POST /api/leads/outreach/skip
//   営業フォーム（OS内）で「送付見送り」にした記録をOSへ反映する。
//   - LeadLog に action="FORM_SKIPPED" として理由＋メモを記録
//   - Lead.memo の末尾に【送付見送り】の1行を追記（リード管理のメモ欄で見える）
//   - ステータスは変えない（却下ではない＝一覧から消えない・解除できる）
//   body: { leadId: string; reason?: string; note?: string; action: "mark" | "unmark" }
// ---------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { leadId?: string; reason?: string; note?: string; action?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId, action } = payload;
  if (typeof leadId !== "string" || !leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, memo: true } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // 見送り解除 → 直近の見送りログを消し、メモに足した1行だけを取り除く
  if (action === "unmark") {
    const last = await db.leadLog.findFirst({
      where: { leadId, action: FORM_SKIPPED },
      orderBy: { createdAt: "desc" },
    });
    if (last) {
      const parsed = parseSkipDetail(last.detail);
      const memo = parsed
        ? removeSkipMemo(lead.memo, buildSkipMemoLine(parsed.reasonLabel, parsed.note))
        : lead.memo;
      await db.$transaction([
        db.leadLog.delete({ where: { id: last.id } }),
        db.lead.update({ where: { id: leadId }, data: { memo } }),
      ]);
    }
    return NextResponse.json({ ok: true });
  }

  // 見送り登録
  const reasonRaw = typeof payload.reason === "string" ? payload.reason : "";
  const reason = getOutreachSkipReason(reasonRaw)?.value as OutreachSkipReasonValue | undefined;
  if (!reason) {
    return NextResponse.json(
      { error: `reason must be one of ${OUTREACH_SKIP_REASONS.map((r) => r.value).join(", ")}` },
      { status: 400 },
    );
  }
  const note = (typeof payload.note === "string" ? payload.note : "").trim().slice(0, 500);
  const staffName = user.name ?? session.user.email;
  const reasonLabel = getOutreachSkipReason(reason)?.label ?? "その他";

  // 同じリードを二度見送りにしても行が増えないよう、前回分は消してから入れ直す
  const prev = await db.leadLog.findFirst({
    where: { leadId, action: FORM_SKIPPED },
    orderBy: { createdAt: "desc" },
  });
  let memo = lead.memo;
  if (prev) {
    const parsed = parseSkipDetail(prev.detail);
    if (parsed) memo = removeSkipMemo(memo, buildSkipMemoLine(parsed.reasonLabel, parsed.note));
  }
  memo = appendSkipMemo(memo, buildSkipMemoLine(reasonLabel, note));

  await db.$transaction([
    ...(prev ? [db.leadLog.delete({ where: { id: prev.id } })] : []),
    db.leadLog.create({
      data: { action: FORM_SKIPPED, detail: buildSkipDetail(reason, note), staffName, leadId },
    }),
    db.lead.update({ where: { id: leadId }, data: { memo } }),
  ]);

  return NextResponse.json({ ok: true, reasonLabel, note });
}
