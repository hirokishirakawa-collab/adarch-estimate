"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------
// 報告先の県を切り替える（2拠点の代表のみ）
//
// OSの登録（商談・送付・リード操作・月次報告・AI連携の記録）は全て
// 主拠点 branchId に入る。主拠点と第2拠点を入れ替えるだけで、以後の登録が
// 選んだ県になる。見える範囲は getBranchFilter が両方を見るので変わらない。
// ロイヤリティは会社(groupCompany)単位の集計なので、どちらで報告しても額は同じ。
// 過去の登録は動かさない。
// ---------------------------------------------------------------
export async function switchReportBranch(targetBranchId: string) {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role === "ADMIN") return { error: "本部アカウントは対象外です" };
  if (!info.branchId || !info.branchId2) return { error: "2拠点のアカウントのみ切り替えできます" };

  if (targetBranchId === info.branchId) return { success: true };
  if (targetBranchId !== info.branchId2) return { error: "担当していない拠点です" };

  await db.user.update({
    where: { id: info.userId },
    data: { branchId: info.branchId2, branchId2: info.branchId },
  });
  logAudit({
    action: "report_branch_switched",
    email: info.email,
    name: info.staffName,
    entity: "user",
    entityId: info.userId,
    detail: `${info.branchId} → ${info.branchId2}`,
  });

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
