// POST /api/ad-buyers/untag — 一括「ファインダーから外す」（媒体タグを空にする。リードは消さない）
//   ログイン必須。周年ファインダーの「営業対象から外す」と同じく、ログインした人なら誰でも押せる
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { validateBody } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { untagAdBuyers } from "@/lib/ad-buyers/list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const untagSchema = z.object({ leadIds: z.array(z.string().min(1)).min(1).max(500) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await validateBody(req, untagSchema);
  if (!parsed.success) return parsed.response;
  const count = await untagAdBuyers(parsed.data.leadIds);
  void logAudit({ action: "ad_buyers_untag", email: session.user.email, name: session.user.name ?? null, entity: "lead", detail: `${count}件をファインダーから外した` });
  return NextResponse.json({ ok: true, count });
}
