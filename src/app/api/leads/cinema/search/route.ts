import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, cinemaSearchSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { CINEMA_TARGET_INDUSTRIES, getRadiusBand } from "@/lib/constants/cinema-leads";
import type { CinemaPlaceLead } from "@/lib/constants/cinema-leads";

export const runtime = "nodejs";
export const maxDuration = 120;

// ----------------------------------------------------------------
// ジオコーディング: 住所 → 緯度経度
// ----------------------------------------------------------------
async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "ja");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  const loc = data.results?.[0]?.geometry?.location;
  if (!loc) return null;

  return { lat: loc.lat, lng: loc.lng };
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
    // 1) 劇場の座標を取得
    const theaterLoc = await geocodeAddress(
      `イオンシネマ${body.theaterName} ${body.theaterAddress}`,
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
        // Text Search: placeType が null の業種（結婚式場、建設業等）
        requestBody.textQuery = ind.keywords;
        requestBody.locationBias = {
          circle: {
            center: { latitude: theaterLoc.lat, longitude: theaterLoc.lng },
            radius: body.radius,
          },
        };
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

        allPlaces.push({
          name,
          address,
          phone: (p.internationalPhoneNumber as string) ?? "",
          rating: (p.rating as number) ?? 0,
          ratingCount: (p.userRatingCount as number) ?? 0,
          types: (p.types as string[]) ?? [],
          mapsUrl: (p.googleMapsUri as string) ?? "",
          websiteUrl: (p.websiteUri as string) ?? "",
          businessStatus: (p.businessStatus as string) ?? "",
          distanceKm: Math.round(distanceKm * 100) / 100,
          radiusBand: getRadiusBand(distanceKm),
          lat: pLat,
          lng: pLng,
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
