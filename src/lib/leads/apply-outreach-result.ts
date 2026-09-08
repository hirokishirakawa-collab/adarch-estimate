// ==============================================================
// 送った先の「結果」を1件分だけ適用する本体（サーバーアクションではない）
//   OS画面の結果ボタン（actions/outreach-result.ts）と AI連携（MCP）の両方から呼ぶ。
//   1. リードに結果を保存（同じボタンをもう一度押すと取り消し）
//   2. ステータスを必要な分だけ動かす（手で進めた状態は巻き戻さない）
//   3. グループ事例DB（SalesApproach）へ写す
// ==============================================================
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { getOutreachResultOption } from "@/lib/constants/outreach-result";
import type { LeadStatus } from "@/generated/prisma/client";

export const FORM_SENT = "FORM_SENT";
export const RESULT_ACTION = "OUTREACH_RESULT";

// ---------------------------------------------------------------
// 1件分の本体。単発／一括の両方から呼ぶ
// ---------------------------------------------------------------
type LeadRow = NonNullable<Awaited<ReturnType<typeof db.lead.findUnique>>>;

export async function applyOutreachResult(
  lead: LeadRow,
  option: NonNullable<ReturnType<typeof getOutreachResultOption>>,
  user: { id: string; name: string | null; groupCompanyId: string | null },
  email: string,
  opts: { allowUndo: boolean },
): Promise<{ error?: string; result?: string | null }> {
  const leadId = lead.id;
  const staffName = user.name ?? email;

  // 同じ結果をもう一度押したら取り消し（押し間違いをその場で戻せるように）
  const isUndo = opts.allowUndo && lead.outreachResult === option.value;

  try {
    if (isUndo) {
      await db.lead.update({
        where: { id: leadId },
        data: { outreachResult: null, outreachResultAt: null },
      });
      await db.leadLog.create({
        data: {
          leadId,
          action: RESULT_ACTION,
          detail: `結果「${option.label}」を取り消し（返事待ちに戻しました）`,
          staffName,
        },
      });
      // 事例DB側も取り消す。自動生成した分だけを消す（人が手で書いた事例は leadId が付かない）
      await db.salesApproach.deleteMany({ where: { leadId } });
      return { result: null };
    }

    // ステータスは指定の状態からだけ動かす
    let statusPatch: { status?: LeadStatus } = {};
    if (option.statusMove && option.statusMove.from.includes(lead.status)) {
      statusPatch = { status: option.statusMove.to };
    }

    await db.lead.update({
      where: { id: leadId },
      data: {
        outreachResult: option.value,
        outreachResultAt: new Date(),
        ...statusPatch,
      },
    });

    const statusNote = statusPatch.status ? `／ステータスを${statusPatch.status}へ` : "";
    await db.leadLog.create({
      data: {
        leadId,
        action: RESULT_ACTION,
        detail: `送付結果を「${option.label}」で記録${statusNote}`,
        staffName,
      },
    });

    await syncSalesApproach(leadId, option.approachResult, user, lead);

    logAudit({
      action: "outreach_result_recorded",
      email,
      name: staffName,
      entity: "lead",
      entityId: leadId,
      detail: `${lead.name} / ${option.label}`,
    });

    return { result: option.value };
  } catch (e) {
    console.error("[applyOutreachResult] error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }
}

// ---------------------------------------------------------------
// グループ事例DBへ写す（1リード1件。押し直したら結果だけ更新）
// ---------------------------------------------------------------
async function syncSalesApproach(
  leadId: string,
  approachResult: "DEAL" | "REPLIED_OK" | "REPLIED_NG" | "NO_REPLY" | "REJECTED",
  user: { id: string; groupCompanyId: string | null },
  lead: { industry: string | null; area: string | null; prefecture: string | null },
) {
  // 加盟会社に紐づかないユーザーは事例DBの投稿者になれない（結果の記録自体は済んでいる）
  if (!user.groupCompanyId) return;

  // 送った文面は送付ログに入っている。無ければ写す中身が無いので作らない
  const sentLog = await db.leadLog.findFirst({
    where: { leadId, action: FORM_SENT },
    orderBy: { createdAt: "desc" },
    select: { detail: true, packageId: true },
  });
  if (!sentLog?.detail) return;

  const existing = await db.salesApproach.findFirst({
    where: { leadId },
    select: { id: true },
  });
  if (existing) {
    await db.salesApproach.update({
      where: { id: existing.id },
      // 送り直してから結果を入れた場合に備え、文面・パッケージも最新の送付ログに合わせる
      data: { result: approachResult, messageBody: sentLog.detail, packageId: sentLog.packageId },
    });
    return;
  }

  await db.salesApproach.create({
    data: {
      groupCompanyId: user.groupCompanyId,
      authorId: user.id,
      leadId,
      // どのパッケージで当たったか（パッケージ画面の「送付・返信・受注」に戻る）
      packageId: sentLog.packageId,
      industry: lead.industry ?? "その他",
      targetDesc: [lead.area ?? lead.prefecture, lead.industry].filter(Boolean).join("・") || null,
      method: "FORM",
      messageBody: sentLog.detail,
      result: approachResult,
    },
  });
}

