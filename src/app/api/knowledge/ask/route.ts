// POST /api/knowledge/ask  { question, sourceIds?, origin? } → 出典つきの答え（全員）
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { askKnowledge } from "@/lib/knowledge/ask";
import { requireReader } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { error, info } = await requireReader();
  if (error) return error;
  const limited = checkRateLimit(info.email, "knowledge-ask", AI_RATE_LIMIT);
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { question?: unknown; sourceIds?: unknown; origin?: unknown };
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 2) return NextResponse.json({ error: "質問を入れてください" }, { status: 400 });
  const sourceIds = Array.isArray(body.sourceIds) ? body.sourceIds.filter((x): x is string => typeof x === "string").slice(0, 8) : undefined;
  const origin = body.origin === "OWN" || body.origin === "EXTERNAL" ? body.origin : undefined;
  try {
    const result = await askKnowledge({ question, isAdmin: info.role === "ADMIN", sourceIds, origin });
    void logAudit({ action: "knowledge_ask", email: info.email, name: info.staffName, entity: "knowledge_source", detail: `${question.slice(0, 200)} → ${result.sources.map((s) => s.title).join(" / ")}`.slice(0, 500) });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[knowledge:ask]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "回答の生成に失敗しました。少し待ってからもう一度お試しください" }, { status: 500 });
  }
}
