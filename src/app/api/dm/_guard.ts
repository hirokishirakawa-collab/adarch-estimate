// 郵送DM API 共通: ログイン必須。履歴（DmKit）は自分が作ったもの＋同じ拠点のもの。ADMINは全件
import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/session";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function requireDmUser() {
  const info = await getSessionInfo();
  if (!info) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), info: null, me: null };
  const me = await db.user.findUnique({ where: { id: info.userId }, select: { id: true, role: true, groupCompanyId: true, name: true, email: true } });
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), info: null, me: null };
  return { error: null, info, me };
}

export function kitScope(me: { id: string; role: string; groupCompanyId: string | null }): Prisma.DmKitWhereInput {
  if (me.role === "ADMIN") return {};
  return me.groupCompanyId ? { OR: [{ createdById: me.id }, { groupCompanyId: me.groupCompanyId }] } : { createdById: me.id };
}
