// ==============================================================
// Google Places (New) Text Search で企業リストを取る（2026-09-09 に /api/leads/search から切り出し・動きは同じ）
//   OS画面（/api/leads/search）と AI連携（discover_leads）の両方から呼ぶ
// ==============================================================
import type { PlaceLead } from "@/lib/constants/leads";

export interface PlacesSearchInput {
  prefecture: string;
  city?: string;
  industry: string;
  industryKeywords?: string;
  count: number;
}

export async function searchPlaces(body: PlacesSearchInput, apiKey: string): Promise<PlaceLead[]> {
  const query = [body.industryKeywords || body.industry, body.city, body.prefecture]
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
    // 2026 Google Maps アップデート: AI サマリー + 新フィールド
    "places.reviewSummary",
    "places.generativeSummary",
    "places.neighborhoodSummary",
    "places.googleMapsTypeLabel",
  ].join(",");

    const allPlaces: Record<string, unknown>[] = [];
    let pageToken: string | undefined;

    // Google Places Text Search は最大20件/リクエスト。50件の場合はページネーション
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
        throw new Error(`Google Places API エラー (${res.status})`);
      }

      const data = await res.json();
      const places = data.places ?? [];
      allPlaces.push(...places);

      pageToken = data.nextPageToken;
      if (!pageToken || places.length === 0) break;
    }

    // 統一フォーマットに変換
    const results = allPlaces.slice(0, maxCount).map((p: Record<string, unknown>) => {
      // AI サマリー抽出
      const reviewSummaryObj = p.reviewSummary as { text?: { text?: string } } | undefined;
      const generativeSummaryObj = p.generativeSummary as { overview?: { text?: string } } | undefined;
      const neighborhoodObj = p.neighborhoodSummary as {
        overview?: { content?: { text?: string } };
        description?: { content?: { text?: string } };
      } | undefined;

      // 近日開業判定: businessStatus が CLOSED_TEMPORARILY でなく、かつ future opening として返された場合
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

    return results as PlaceLead[];
}
