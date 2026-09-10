// POST /api/ad-buyers/scan — 広告出稿者ファインダーの「探す」（Google Places → 媒体判定 → 判定できた店だけ保存）
//   ログイン必須。AI採点は呼ばない。Places の件数は最大60（費用の蓋）
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { loadViewer } from "@/lib/mcp/os-read-tools";
import { validateBody } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { scanAdBuyers } from "@/lib/ad-buyers/scan";
import { AD_BUYER_MAX_COUNT } from "@/lib/ad-buyers/platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const scanSchema = z.object({
  prefecture: z.string().min(1, "都道府県は必須です").max(10),
  city: z.string().max(40).optional().default(""),
  industry: z.string().min(1, "業種は必須です").max(40),
  count: z.number().int().min(1).max(AD_BUYER_MAX_COUNT).optional().default(20),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = await loadViewer(session.user.email);
  if (!viewer) return NextResponse.json({ error: "このアカウントは利用できません" }, { status: 403 });

  const limited = checkRateLimit(viewer.email, "ad-buyers/scan", AI_RATE_LIMIT);
  if (limited) return limited;

  const parsed = await validateBody(req, scanSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  try {
    const result = await scanAdBuyers(viewer, body);
    void logAudit({
      action: "ad_buyers_scan", email: viewer.email, name: viewer.name, entity: "lead",
      detail: `${body.prefecture}${body.city} ${body.industry} 取得${result.found}・掲載${result.matched}・保存${result.saved}・更新${result.updated}`.slice(0, 300),
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[ad-buyers/scan]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "探索中にエラーが発生しました" }, { status: 500 });
  }
}
