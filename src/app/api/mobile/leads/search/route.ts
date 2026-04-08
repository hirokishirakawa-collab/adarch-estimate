import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "../../_lib/verify-mobile-token";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// POST /api/mobile/leads/search
// Wrap Google Places API (New) Text Search for mobile
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: {
    prefecture?: string;
    city?: string;
    industry?: string;
    limit?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.prefecture?.trim()) {
    return NextResponse.json(
      { error: "prefecture is required" },
      { status: 400 }
    );
  }

  if (!body.industry?.trim()) {
    return NextResponse.json(
      { error: "industry is required" },
      { status: 400 }
    );
  }

  const maxCount = body.limit
    ? Math.min(Math.max(1, body.limit), 50)
    : 20;

  const query = [body.industry, body.city, body.prefecture]
    .filter(Boolean)
    .join(" ");

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
  ].join(",");

  try {
    const allPlaces: Record<string, unknown>[] = [];
    let pageToken: string | undefined;

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
          { error: `Google Places API error (${res.status})` },
          { status: 502 }
        );
      }

      const data = await res.json();
      const places = data.places ?? [];
      allPlaces.push(...places);

      pageToken = data.nextPageToken;
      if (!pageToken || places.length === 0) break;
    }

    const results = allPlaces
      .slice(0, maxCount)
      .map((p: Record<string, unknown>) => ({
        name: (p.displayName as { text?: string })?.text ?? "",
        address: (p.formattedAddress as string) ?? "",
        phone: (p.internationalPhoneNumber as string) ?? "",
        rating: (p.rating as number) ?? 0,
        ratingCount: (p.userRatingCount as number) ?? 0,
        types: (p.types as string[]) ?? [],
        mapsUrl: (p.googleMapsUri as string) ?? "",
        websiteUrl: (p.websiteUri as string) ?? "",
        businessStatus: (p.businessStatus as string) ?? "",
      }));

    return NextResponse.json({ places: results });
  } catch (err) {
    console.error("[POST /api/mobile/leads/search]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
