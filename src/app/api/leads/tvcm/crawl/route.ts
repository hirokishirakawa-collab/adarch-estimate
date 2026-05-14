import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateBody, tvcmCrawlSchema } from "@/lib/validations";
import { checkRateLimit, TVCM_RATE_LIMIT } from "@/lib/rate-limit";
import { runTvcmCrawl } from "@/lib/leads/tvcm-crawler";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 配布モデル: クロールは ADMIN（代表）のみ
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });
  if (user?.role !== "ADMIN") {
    return NextResponse.json(
      { error: "クロール機能は管理者専用です" },
      { status: 403 },
    );
  }

  const limited = checkRateLimit(
    session.user.email,
    "leads/tvcm/crawl",
    TVCM_RATE_LIMIT,
  );
  if (limited) return limited;

  const parsed = await validateBody(req, tvcmCrawlSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  try {
    const outcome = await runTvcmCrawl(body, {
      userId: user.id,
      staffName: session.user.name ?? session.user.email ?? "ADMIN",
    });
    return NextResponse.json({
      candidates: outcome.candidates,
      results: outcome.results,
      stats: outcome.stats,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "クロール中にエラーが発生しました";
    console.error("[/api/leads/tvcm/crawl] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
