"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOutreachResultOption } from "@/lib/constants/outreach-result";
import { applyOutreachResult } from "@/lib/leads/apply-outreach-result";

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

function revalidateOutreachPaths() {
  // 「返事待ち」画面はサーバーアクション後に自動で再描画されるので指定しない
  revalidatePath("/dashboard/leads/list");
  revalidatePath("/dashboard/leads/outreach");
  revalidatePath("/dashboard/sales-approaches");
}
