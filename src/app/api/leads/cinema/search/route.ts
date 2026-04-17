import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, cinemaSearchSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { CINEMA_TARGET_INDUSTRIES, getRadiusBand } from "@/lib/constants/cinema-leads";
import type { CinemaPlaceLead } from "@/lib/constants/cinema-leads";

export const runtime = "nodejs";
export const maxDuration = 120;

// ----------------------------------------------------------------
// Google Places Text Search で劇場の座標を取得
// ----------------------------------------------------------------
async function findTheaterLocation(
  theaterName: string,
  theaterAddress: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  const fieldMask = "places.location,places.displayName";
  const query = `イオンシネマ${theaterName}`;

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 1,
        languageCode: "ja",
      }),
    }
  );

  if (!res.ok) {
    console.error("Theater location search failed:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const place = data.places?.[0];
  if (!place?.location) return null;

  const loc = place.location as { latitude?: number; longitude?: number };
  if (!loc.latitude || !loc.longitude) return null;

  return { lat: loc.latitude, lng: loc.longitude };
}

// ----------------------------------------------------------------
// Haversine 距離計算 (km)
// ----------------------------------------------------------------
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ----------------------------------------------------------------
// POST /api/leads/cinema/search
// イオンシネマ劇場を中心に、半径内の対象企業を検索
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email!, "leads/cinema/search", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const parsed = await validateBody(req, cinemaSearchSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  try {
    // 1) Google Places Text Search で劇場の座標を取得
    const theaterLoc = await findTheaterLocation(
      body.theaterName,
      body.theaterAddress,
      apiKey
    );
    if (!theaterLoc) {
      return NextResponse.json(
        { error: "劇場の位置情報を取得できませんでした" },
        { status: 400 }
      );
    }

    // 2) 選択された業種のキーワードを集約
    const selectedIndustries = CINEMA_TARGET_INDUSTRIES.filter((ind) =>
      body.industries.includes(ind.value)
    );

    // 3) 各業種でNearby Search を実行
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
      "places.location",
      // 2026 Google Maps アップデート: AI サマリー + 新フィールド
      "places.reviewSummary",
      "places.generativeSummary",
      "places.neighborhoodSummary",
      "places.googleMapsTypeLabel",
    ].join(",");

    const allPlaces: CinemaPlaceLead[] = [];
    const seen = new Set<string>(); // 重複排除（名前+住所）

    for (const ind of selectedIndustries) {
      const useNearby = ind.placeType !== null;

      const requestBody: Record<string, unknown> = {
        maxResultCount: Math.min(20, body.count),
        languageCode: "ja",
      };

      if (useNearby) {
        // Nearby Search: placeType が定義されている業種
        requestBody.includedTypes = [ind.placeType];
        requestBody.locationRestriction = {
          circle: {
            center: { latitude: theaterLoc.lat, longitude: theaterLoc.lng },
            radius: body.radius,
          },
        };
      } else {
        // Text Search: placeType が null の業種（建設業等）
        requestBody.textQuery = ind.keywords;
        requestBody.locationBias = {
          circle: {
            center: { latitude: theaterLoc.lat, longitude: theaterLoc.lng },
            radius: body.radius,
          },
        };
        requestBody.includeFutureOpeningBusinesses = true;
      }

      const endpoint = useNearby
        ? "https://places.googleapis.com/v1/places:searchNearby"
        : "https://places.googleapis.com/v1/places:searchText";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        console.error(`Cinema search error for ${ind.value}:`, res.status, await res.text());
        continue;
      }

      const data = await res.json();
      const places = data.places ?? [];

      for (const p of places) {
        const name = (p.displayName as { text?: string })?.text ?? "";
        const address = (p.formattedAddress as string) ?? "";
        const key = `${name}|${address}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const pLat = (p.location as { latitude?: number })?.latitude ?? 0;
        const pLng = (p.location as { longitude?: number })?.longitude ?? 0;
        const distanceKm = haversineKm(theaterLoc.lat, theaterLoc.lng, pLat, pLng);

        // 半径内のみ
        if (distanceKm > body.radius / 1000) continue;

        // AI サマリー抽出
        const reviewSummaryObj = p.reviewSummary as { text?: { text?: string } } | undefined;
        const generativeSummaryObj = p.generativeSummary as { overview?: { text?: string } } | undefined;
        const neighborhoodObj = p.neighborhoodSummary as {
          overview?: { content?: { text?: string } };
          description?: { content?: { text?: string } };
        } | undefined;
        const bs = (p.businessStatus as string) ?? "";

        allPlaces.push({
          name,
          address,
          phone: (p.internationalPhoneNumber as string) ?? "",
          rating: (p.rating as number) ?? 0,
          ratingCount: (p.userRatingCount as number) ?? 0,
          types: (p.types as string[]) ?? [],
          mapsUrl: (p.googleMapsUri as string) ?? "",
          websiteUrl: (p.websiteUri as string) ?? "",
          businessStatus: bs,
          distanceKm: Math.round(distanceKm * 100) / 100,
          radiusBand: getRadiusBand(distanceKm),
          lat: pLat,
          lng: pLng,
          reviewSummary: reviewSummaryObj?.text?.text ?? undefined,
          placeSummary: generativeSummaryObj?.overview?.text ?? undefined,
          neighborhoodSummary:
            neighborhoodObj?.overview?.content?.text ??
            neighborhoodObj?.description?.content?.text ??
            undefined,
          googleMapsTypeLabel: (p.googleMapsTypeLabel as string) ?? undefined,
          isFutureOpening: bs === "FUTURE_OPENING" || undefined,
        });
      }
    }

    // 距離順でソート
    allPlaces.sort((a, b) => a.distanceKm - b.distanceKm);

    return NextResponse.json({
      places: allPlaces.slice(0, body.count),
      theater: {
        name: body.theaterName,
        lat: theaterLoc.lat,
        lng: theaterLoc.lng,
      },
    });
  } catch (err) {
    console.error("Cinema search error:", err);
    return NextResponse.json(
      { error: "企業検索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
