"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { getStage, getMethodLabel } from "@/lib/constants/group-move";
import type { GroupMoveMethod, GroupMoveStage } from "@/generated/prisma/client";

const PATH = "/dashboard/group-moves";
const NOTE_MAX = 120;

const STAGES: GroupMoveStage[] = ["APPROACHING", "REPLIED", "MEETING", "PROPOSAL", "WON", "LOST"];
const METHODS: GroupMoveMethod[] = [
  "FORM", "EMAIL", "DM", "PHONE", "VISIT", "REFERRAL", "EXISTING", "OTHER",
];

async function me() {
  const info = await getSessionInfo();
  if (!info) return null;
  const user = await db.user.findUnique({
    where: { id: info.userId },
    select: { groupCompanyId: true },
  });
  return { ...info, groupCompanyId: user?.groupCompanyId ?? null };
}

// ---------------------------------------------------------------
// 動きを1件足す（業種・当たり方・段階・一言の4つだけ）
// ---------------------------------------------------------------
export async function addGroupMove(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const info = await me();
  if (!info) return { error: "ログインが必要です" };
  if (!info.groupCompanyId) return { error: "加盟会社に紐づいていないアカウントです" };

  const industry = (formData.get("industry") as string)?.trim();
  const method = (formData.get("method") as string)?.trim() as GroupMoveMethod;
  const stage = ((formData.get("stage") as string)?.trim() || "APPROACHING") as GroupMoveStage;
  const note = ((formData.get("note") as string) ?? "").trim().slice(0, NOTE_MAX) || null;

  if (!industry) return { error: "業種を選んでください" };
  if (!METHODS.includes(method)) return { error: "当たり方を選んでください" };
  if (!STAGES.includes(stage)) return { error: "段階の指定が不正です" };

  try {
    await db.groupMove.create({
      data: {
        groupCompanyId: info.groupCompanyId,
        authorId: info.userId,
        industry,
        method,
        stage,
        note,
      },
    });
    logAudit({
      action: "group_move_created",
      email: info.email,
      name: info.staffName,
      entity: "group_move",
      detail: `${industry} / ${getMethodLabel(method)} / ${getStage(stage).label}`,
    });
  } catch (e) {
    console.error("[addGroupMove]", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath(PATH);
  return { ok: true };
}

// ---------------------------------------------------------------
// 段階を1クリックで動かす。押した時刻が「更新」になる。
// 自分の拠点の動きだけ触れる。
// ---------------------------------------------------------------
export async function moveStage(
  moveId: string,
  stage: string,
): Promise<{ error?: string; stage?: string }> {
  const info = await me();
  if (!info) return { error: "ログインが必要です" };
  if (!STAGES.includes(stage as GroupMoveStage)) return { error: "段階の指定が不正です" };

  const move = await db.groupMove.findUnique({
    where: { id: moveId },
    select: { groupCompanyId: true },
  });
  if (!move) return { error: "この動きは見つかりません" };
  if (move.groupCompanyId !== info.groupCompanyId) {
    return { error: "自分の拠点の動きだけ変えられます" };
  }

  try {
    await db.groupMove.update({
      where: { id: moveId },
      data: { stage: stage as GroupMoveStage, movedAt: new Date() },
    });
  } catch (e) {
    console.error("[moveStage]", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  revalidatePath(PATH);
  return { stage };
}

// ---------------------------------------------------------------
// 「まだ動いてる」＝段階は変えず日付だけ更新。
// 進んでいない案件を進んだことにせずに、生きていることだけ示せるようにする。
// ---------------------------------------------------------------
export async function touchGroupMove(moveId: string): Promise<{ error?: string; ok?: boolean }> {
  const info = await me();
  if (!info) return { error: "ログインが必要です" };

  const move = await db.groupMove.findUnique({
    where: { id: moveId },
    select: { groupCompanyId: true },
  });
  if (!move) return { error: "この動きは見つかりません" };
  if (move.groupCompanyId !== info.groupCompanyId) {
    return { error: "自分の拠点の動きだけ変えられます" };
  }

  await db.groupMove.update({ where: { id: moveId }, data: { movedAt: new Date() } });
  revalidatePath(PATH);
  return { ok: true };
}

// ---------------------------------------------------------------
// 削除（自分の拠点のもの、または本部）
// ---------------------------------------------------------------
export async function deleteGroupMove(moveId: string): Promise<{ error?: string; ok?: boolean }> {
  const info = await me();
  if (!info) return { error: "ログインが必要です" };

  const move = await db.groupMove.findUnique({
    where: { id: moveId },
    select: { groupCompanyId: true },
  });
  if (!move) return { error: "この動きは見つかりません" };
  if (info.role !== "ADMIN" && move.groupCompanyId !== info.groupCompanyId) {
    return { error: "自分の拠点の動きだけ消せます" };
  }

  await db.groupMove.delete({ where: { id: moveId } });
  logAudit({
    action: "group_move_deleted",
    email: info.email,
    name: info.staffName,
    entity: "group_move",
    entityId: moveId,
  });
  revalidatePath(PATH);
  return { ok: true };
}
