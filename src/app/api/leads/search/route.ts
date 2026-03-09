import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const body = (await req.json()) as {
    prefecture: string;
    city: string;
    industry: string;
    industryKeywords: string;
    count: number;
  };

  const query = [body.industryKeywords || body.industry, body.city, body.prefecture]
    .filter(Boolean)
    .join(" ");

  const maxCount = Math.min(body.count || 20, 50);
  const fieldMask = [
    "places.displayName",
    "places.formattedAddress",
    "places.internationalPhoneNumber",
    "places.rating",
    "places.userRatingCount",
    "places.businessStatus",
    "places.types",
    "places.googleMapsUri",
  ].join(",");

  try {
    const allPlaces: Record<string, unknown>[] = [];
    let pageToken: string | undefined;

    // Google Places Text Search は最大20件/リクエスト。50件の場合はページネーション
    while (allPlaces.length < maxCount) {
      const requestBody: Record<string, unknown> = {
        textQuery: query,
        maxResultCount: Math.min(20, maxCount - allPlaces.length),
        languageCode: "ja",
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
    const results = allPlaces.slice(0, maxCount).map((p: Record<string, unknown>) => ({
      name: (p.displayName as { text?: string })?.text ?? "",
      address: (p.formattedAddress as string) ?? "",
      phone: (p.internationalPhoneNumber as string) ?? "",
      rating: (p.rating as number) ?? 0,
      ratingCount: (p.userRatingCount as number) ?? 0,
      types: (p.types as string[]) ?? [],
      mapsUrl: (p.googleMapsUri as string) ?? "",
      businessStatus: (p.businessStatus as string) ?? "",
    }));

    return NextResponse.json({ places: results });
  } catch (err) {
    console.error("Places search error:", err);
    return NextResponse.json(
      { error: "企業検索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
