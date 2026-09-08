"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

/** 自分のAI接続を解除する（リフレッシュトークン失効。アクセストークンも次の検証で弾かれる） */
export async function revokeMcpGrant(formData: FormData): Promise<void> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const g = await db.oAuthGrant.findFirst({ where: { id, userEmail: email, revokedAt: null }, select: { id: true, clientName: true } });
  if (!g) return;
  await db.oAuthGrant.update({ where: { id: g.id }, data: { revokedAt: new Date() } });
  await logAudit({ action: "mcp_disconnected", email, name: session?.user?.name ?? null, entity: "oauth_grant", entityId: g.id, detail: g.clientName ?? "AIクライアント" });
  revalidatePath("/dashboard/brand-kit");
}
