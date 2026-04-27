import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, franchiseLeadSearchSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { UserRole } from "@/types/roles";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// POST /api/franchise-leads/search
// Google Places API (New) Text Search で加盟候補企業リストを取得
// ADMIN限定
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const limited = checkRateLimit(session.user.email!, "franchise-leads/search", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const parsed = await validateBody(req, franchiseLeadSearchSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const query = [body.businessTypeKeywords || body.businessType, body.city, body.prefecture]
    .filter(Boolean)
    .join(" ");

  const maxCount = body.count;
  const fieldMask = [
    "places.displayName",
    "places.formattedAddress",
    "places.internationalPhoneNumber",
    "places.rating",
    "places.userRatingCount",
    "places.businessStatus",
    "places.types",
    "places.googleMapsUri",
    "places.websiteUri",
    "places.reviewSummary",
    "places.generativeSummary",
    "places.neighborhoodSummary",
    "places.googleMapsTypeLabel",
  ].join(",");

  try {
    const allPlaces: Record<string, unknown>[] = [];
    let pageToken: string | undefined;

    while (allPlaces.length < maxCount) {
      const requestBody: Record<string, unknown> = {
        textQuery: query,
        maxResultCount: Math.min(20, maxCount - allPlaces.length),
        languageCode: "ja",
        includeFutureOpeningBusinesses: true,
      };
      if (pageToken) {
        requestBody.pageToken = pageToken;
      }

      const res = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": fieldMask,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error("Google Places API error:", res.status, errText);
        return NextResponse.json(
          { error: `Google Places API エラー (${res.status})` },
          { status: 502 }
        );
      }

      const data = await res.json();
      const places = data.places ?? [];
      allPlaces.push(...places);

      pageToken = data.nextPageToken;
      if (!pageToken || places.length === 0) break;
    }

    // 統一フォーマットに変換
    const results = allPlaces.slice(0, maxCount).map((p: Record<string, unknown>) => {
      const reviewSummaryObj = p.reviewSummary as { text?: { text?: string } } | undefined;
      const generativeSummaryObj = p.generativeSummary as { overview?: { text?: string } } | undefined;
      const neighborhoodObj = p.neighborhoodSummary as {
        overview?: { content?: { text?: string } };
        description?: { content?: { text?: string } };
      } | undefined;

      const bs = (p.businessStatus as string) ?? "";
      const isFutureOpening = bs === "FUTURE_OPENING";

      return {
        name: (p.displayName as { text?: string })?.text ?? "",
        address: (p.formattedAddress as string) ?? "",
        phone: (p.internationalPhoneNumber as string) ?? "",
        rating: (p.rating as number) ?? 0,
        ratingCount: (p.userRatingCount as number) ?? 0,
        types: (p.types as string[]) ?? [],
        mapsUrl: (p.googleMapsUri as string) ?? "",
        websiteUrl: (p.websiteUri as string) ?? "",
        businessStatus: bs,
        reviewSummary: reviewSummaryObj?.text?.text ?? undefined,
        placeSummary: generativeSummaryObj?.overview?.text ?? undefined,
        neighborhoodSummary:
          neighborhoodObj?.overview?.content?.text ??
          neighborhoodObj?.description?.content?.text ??
          undefined,
        googleMapsTypeLabel: (p.googleMapsTypeLabel as { text?: string })?.text ?? undefined,
        isFutureOpening: isFutureOpening || undefined,
      };
    });

    return NextResponse.json({ places: results });
  } catch (err) {
    console.error("Franchise lead search error:", err);
    return NextResponse.json(
      { error: "加盟候補検索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
