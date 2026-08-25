"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getOutreachResultOption } from "@/lib/constants/outreach-result";
import type { LeadStatus } from "@/generated/prisma/client";

const FORM_SENT = "FORM_SENT";
const RESULT_ACTION = "OUTREACH_RESULT";

// ---------------------------------------------------------------
// 送った先の結果を1クリックで記録する
//   1. リードに結果を保存（同じボタンをもう一度押すと取り消し）
//   2. ステータスを必要な分だけ動かす（手で進めた状態は巻き戻さない）
//   3. グループ事例DB（SalesApproach）へ写す
//      業種・方法・文面は送付ログ（FORM_SENT）から自動で入るので、
//      入力は「結果ボタン1つ」だけで済む。「学び」は後から事例画面で足せる。
//   Google Chat通知は出さない（結果入力のたびに流れると通知が実務の邪魔になる）
// ---------------------------------------------------------------
export async function recordOutreachResult(
  leadId: string,
  result: string,
): Promise<{ error?: string; result?: string | null }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "ログインが必要です" };

  const option = getOutreachResultOption(result);
  if (!option) return { error: "結果の指定が不正です" };

  const [lead, user] = await Promise.all([
    db.lead.findUnique({ where: { id: leadId } }),
    db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, groupCompanyId: true },
    }),
  ]);
  if (!lead) return { error: "リードが見つかりません" };
  if (!user) return { error: "ユーザーが見つかりません" };

  const res = await applyOutreachResult(lead, option, user, session.user.email, { allowUndo: true });
  if (!res.error) revalidateOutreachPaths();
  return res;
}

// ---------------------------------------------------------------
// 一括版：選んだリードにまとめて同じ結果を入れる（返事待ち画面のチェック→一括）
//   ・1件ずつと同じ処理（ステータス／ログ／事例DB）を順に流す
//   ・すでに同じ結果が入っている行は「取り消し」にせず飛ばす（一括で消えると事故になる）
//   ・途中で失敗しても残りは続け、件数で返す
// ---------------------------------------------------------------
const BULK_MAX = 200;

export async function recordOutreachResultBulk(
  leadIds: string[],
  result: string,
): Promise<{ error?: string; done: number; skipped: number; failed: number }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "ログインが必要です", done: 0, skipped: 0, failed: 0 };

  const option = getOutreachResultOption(result);
  if (!option) return { error: "結果の指定が不正です", done: 0, skipped: 0, failed: 0 };

  const ids = Array.from(new Set(leadIds.filter((id) => typeof id === "string" && id))).slice(0, BULK_MAX);
  if (ids.length === 0) return { error: "対象が選ばれていません", done: 0, skipped: 0, failed: 0 };

  const [leads, user] = await Promise.all([
    db.lead.findMany({ where: { id: { in: ids } } }),
    db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, groupCompanyId: true },
    }),
  ]);
  if (!user) return { error: "ユーザーが見つかりません", done: 0, skipped: 0, failed: 0 };

  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const lead of leads) {
    // 未送付／同じ結果が入っている行は対象外
    if (!lead.sentAt || lead.outreachResult === option.value) {
      skipped++;
      continue;
    }
    const res = await applyOutreachResult(lead, option, user, session.user.email, { allowUndo: false });
    if (res.error) failed++;
    else done++;
  }
  skipped += ids.length - leads.length;

  if (done > 0) revalidateOutreachPaths();
  return { done, skipped, failed };
}

// ---------------------------------------------------------------
// 1件分の本体。単発／一括の両方から呼ぶ
// ---------------------------------------------------------------
type LeadRow = NonNullable<Awaited<ReturnType<typeof db.lead.findUnique>>>;

async function applyOutreachResult(
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
    select: { detail: true },
  });
  if (!sentLog?.detail) return;

  const existing = await db.salesApproach.findFirst({
    where: { leadId },
    select: { id: true },
  });
  if (existing) {
    await db.salesApproach.update({
      where: { id: existing.id },
      // 送り直してから結果を入れた場合に備え、文面も最新の送付ログに合わせる
      data: { result: approachResult, messageBody: sentLog.detail },
    });
    return;
  }

  await db.salesApproach.create({
    data: {
      groupCompanyId: user.groupCompanyId,
      authorId: user.id,
      leadId,
      industry: lead.industry ?? "その他",
      targetDesc: [lead.area ?? lead.prefecture, lead.industry].filter(Boolean).join("・") || null,
      method: "FORM",
      messageBody: sentLog.detail,
      result: approachResult,
    },
  });
}

function revalidateOutreachPaths() {
  // 「返事待ち」画面はサーバーアクション後に自動で再描画されるので指定しない
  revalidatePath("/dashboard/leads/list");
  revalidatePath("/dashboard/leads/outreach");
  revalidatePath("/dashboard/sales-approaches");
}
