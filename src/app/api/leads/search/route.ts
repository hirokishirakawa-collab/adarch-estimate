import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, leadSearchSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { searchPlaces } from "@/lib/leads/places-search";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// POST /api/leads/search
// Google Places API (New) Text Search で企業リストを取得
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email!, "leads/search", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const parsed = await validateBody(req, leadSearchSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  try {
    const results = await searchPlaces(body, apiKey);
    return NextResponse.json({ places: results });
  } catch (err) {
    console.error("Places search error:", err);
    return NextResponse.json(
      { error: "企業検索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
