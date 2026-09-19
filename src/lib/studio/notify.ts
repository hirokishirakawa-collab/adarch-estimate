// ==============================================================
// Ad Arch Studio — 新しい問い合わせの知らせ（OSの中だけ）
//   ⚠️ notifications.ts の共通関数はユーザー設定次第でChat・メールへ転送するので使わない
//      （9/13ルール＝自動の声かけはOSの中だけ）。ベルの通知だけを直接作る
//   代表あての分だけは代表のChatスペースにも送る（2026-09-20 代表指示）
// ==============================================================

import { db } from "@/lib/db";
import { mirrorBellToCeoChat } from "@/lib/notifications";

export async function notifyNewInquiry(input: { label: string; kindLabel: string; pref: string | null; branchId: string | null }): Promise<void> {
  try {
    const [admins, branchUsers] = await Promise.all([
      db.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } }),
      input.branchId
        ? db.user.findMany({ where: { isActive: true, role: { not: "ADMIN" }, OR: [{ branchId: input.branchId }, { branchId2: input.branchId }] }, select: { id: true } })
        : Promise.resolve([] as { id: string }[]),
    ]);
    const title = `Ad Arch Studio に問い合わせ ${input.label}`;
    const message = `${input.kindLabel}${input.pref ? `・${input.pref}` : ""}。営業時間で2時間以内に連絡してください。`;
    const data = [
      ...admins.map((u) => ({ userId: u.id, type: "SYSTEM" as const, title, message, linkUrl: "/dashboard/admin/studio-inquiries" })),
      ...branchUsers.map((u) => ({ userId: u.id, type: "SYSTEM" as const, title, message, linkUrl: "/dashboard/studio-inquiries" })),
    ];
    if (data.length) await db.notification.createMany({ data });
    mirrorBellToCeoChat(data).catch(() => {});
  } catch (e) {
    console.error("[studio] 通知の作成に失敗:", e instanceof Error ? e.message : e);
  }
}
