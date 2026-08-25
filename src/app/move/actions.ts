"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getStage, getMethodLabel } from "@/lib/constants/group-move";
import type { GroupMoveMethod, GroupMoveStage } from "@/generated/prisma/client";

export type MoveState = { ok?: boolean; error?: string } | null;

const STAGES: GroupMoveStage[] = ["APPROACHING", "REPLIED", "MEETING", "PROPOSAL", "WON", "LOST"];
const METHODS: GroupMoveMethod[] = [
  "FORM", "EMAIL", "DM", "PHONE", "VISIT", "REFERRAL", "EXISTING", "OTHER",
];

// ---------------------------------------------------------------
// Chat から開く「動きを出す」フォームの受け口。
//   週次共有フォームと同じ考え方で、ログインは求めず chatSpaceId で拠点を特定する。
//   Chat のスペースに居ること自体がその拠点の人である証明になっているため。
//   投稿者（authorId）はその拠点に紐づくユーザーの誰かを使う。
// ---------------------------------------------------------------
export async function submitMove(_prev: MoveState, formData: FormData): Promise<MoveState> {
  const chatSpaceId = ((formData.get("chatSpaceId") as string) ?? "").trim();
  const companyName = ((formData.get("companyName") as string) ?? "").trim().slice(0, 80);
  const industry = ((formData.get("industry") as string) ?? "").trim();
  const method = ((formData.get("method") as string) ?? "").trim() as GroupMoveMethod;
  const stage = (((formData.get("stage") as string) ?? "").trim() || "APPROACHING") as GroupMoveStage;
  const note = ((formData.get("note") as string) ?? "").trim().slice(0, 120) || null;

  if (!chatSpaceId) return { error: "リンクが正しくありません" };
  if (!companyName) return { error: "会社名を入れてください" };
  if (!industry) return { error: "業界を選んでください" };
  if (!METHODS.includes(method)) return { error: "当たり方を選んでください" };
  if (!STAGES.includes(stage)) return { error: "今どこを選んでください" };

  const company = await db.groupCompany.findFirst({
    where: { chatSpaceId, isActive: true },
    select: { id: true, name: true, linkedUsers: { select: { id: true }, take: 1 } },
  });
  if (!company) return { error: "拠点が見つかりません" };

  const authorId = company.linkedUsers[0]?.id;
  if (!authorId) return { error: "この拠点に紐づくアカウントがありません" };

  try {
    await db.groupMove.create({
      data: {
        groupCompanyId: company.id,
        authorId,
        companyName,
        industry,
        method,
        stage,
        note,
      },
    });
    logAudit({
      action: "group_move_created_from_chat",
      email: "chat@group-move",
      name: company.name,
      entity: "group_move",
      detail: `${companyName} / ${industry} / ${getMethodLabel(method)} / ${getStage(stage).label}`,
    });
  } catch (e) {
    console.error("[submitMove]", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  return { ok: true };
}
