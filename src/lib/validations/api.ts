import { z } from "zod/v4";

// POST /api/leads/search
export const leadSearchSchema = z.object({
  prefecture: z.string().min(1, "都道府県は必須です"),
  city: z.string().optional().default(""),
  industry: z.string().min(1, "業種は必須です"),
  industryKeywords: z.string().optional().default(""),
  count: z.number().int().min(1).max(50).optional().default(20),
});

// POST /api/leads/score
export const leadScoreSchema = z.object({
  places: z
    .array(
      z.object({
        name: z.string(),
        address: z.string(),
        phone: z.string(),
        rating: z.number(),
        ratingCount: z.number(),
        types: z.array(z.string()),
        mapsUrl: z.string(),
        websiteUrl: z.string(),
        businessStatus: z.string(),
        // 2026 Google Maps アップデート: AI サマリー + 新フィールド
        reviewSummary: z.string().optional(),
        placeSummary: z.string().optional(),
        neighborhoodSummary: z.string().optional(),
        googleMapsTypeLabel: z.string().optional(),
        isFutureOpening: z.boolean().optional(),
      })
    )
    .min(1, "企業リストは1件以上必要です")
    .max(50),
  industry: z.string().min(1),
  area: z.string().min(1),
});

// POST /api/proposals/generate
export const proposalGenerateSchema = z.object({
  companyName: z.string().min(1, "企業名は必須です"),
  industry: z.string().min(1, "業種は必須です"),
  challenge: z.string().min(1, "課題は必須です"),
  hearingSheetId: z.string().optional(),
  proposalTitle: z.string().optional(),
  presenter: z.object({
    company: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string(),
  }).optional(),
});

// POST /api/strategy-advisor
export const strategyAdvisorSchema = z.object({
  industry: z.string().optional().default(""),
  gender: z.string().min(1),
  ageRange: z.array(z.string()),
  layer: z.string().min(1),
  inbound: z.boolean(),
  purposes: z.array(z.string()),
  region: z.string().min(1, "実施地域は必須です"),
  budget: z.number().min(0),
  freeText: z.string().optional(),
});

// POST /api/leads/btob/search
export const btobSearchSchema = z.object({
  prefecture: z.string().optional().default(""),
  city: z.string().optional().default(""),
  businessItem: z.string().optional().default(""),
  capitalFrom: z.number().int().min(0).optional(),
  capitalTo: z.number().int().min(0).optional(),
  employeeFrom: z.number().int().min(0).optional(),
  employeeTo: z.number().int().min(0).optional(),
  companyName: z.string().optional().default(""),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

// POST /api/leads/cinema/search
export const cinemaSearchSchema = z.object({
  theaterId: z.number().int(),
  theaterName: z.string().min(1),
  theaterAddress: z.string().min(1),
  radius: z.number().int().min(1000).max(20000), // meters
  industries: z.array(z.string()),
  count: z.number().int().min(1).max(50).optional().default(20),
  customKeywords: z.string().optional(),
});

// POST /api/leads/tvcm/crawl
export const tvcmCrawlSchema = z.object({
  source: z
    .enum(["youtube", "prtimes", "atpress", "both", "all"])
    .optional()
    .default("youtube"),
  keywords: z.array(z.string().min(1)).max(12).optional(),
  maxPerKeyword: z.number().int().min(1).max(20).optional().default(8),
  totalLimit: z.number().int().min(1).max(60).optional().default(30),
  /** YouTube用: チャンネル登録者数の上限（中小判定） */
  maxSubscribers: z.number().int().min(0).max(10_000_000).optional().default(50000),
  /** YouTube用: 発表日が「現在から〜日以内」の動画のみ */
  publishedWithinDays: z.number().int().min(1).max(365).optional().default(60),
  /** 直近 N 日以内に判断済み（プール/却下/claim/ステータス変更/受注）のリードを結果から除外 */
  hideRecentlyDecidedDays: z.number().int().min(0).max(365).optional().default(30),
});

// POST /api/leads/tvcm/save
export const tvcmSaveSchema = z.object({
  candidates: z
    .array(
      z.object({
        pressReleaseUrl: z.string().url(),
        pressReleaseTitle: z.string().min(1),
        announcedDate: z.string().nullable(),
        companyName: z.string().min(1),
        companyWebsite: z.string().nullable(),
        prefecture: z.string().nullable(),
        address: z.string().nullable(),
        videoUrl: z.string().nullable(),
        productionCompany: z.string().nullable(),
        agencyDetected: z.string().nullable(),
        isListed: z.boolean(),
        capital: z.number().nullable(),
        employeeCount: z.number().nullable(),
        industryGuess: z.string().nullable(),
        summary: z.string(),
      })
    )
    .min(1)
    .max(60),
});

// POST /api/leads/cinema/score
export const cinemaScoreSchema = z.object({
  places: z
    .array(
      z.object({
        name: z.string(),
        address: z.string(),
        phone: z.string(),
        rating: z.number(),
        ratingCount: z.number(),
        types: z.array(z.string()),
        mapsUrl: z.string(),
        websiteUrl: z.string(),
        businessStatus: z.string(),
        distanceKm: z.number(),
        radiusBand: z.number(),
        lat: z.number(),
        lng: z.number(),
        // 2026 Google Maps アップデート: AI サマリー + 新フィールド
        reviewSummary: z.string().optional(),
        placeSummary: z.string().optional(),
        neighborhoodSummary: z.string().optional(),
        googleMapsTypeLabel: z.string().optional(),
        isFutureOpening: z.boolean().optional(),
      })
    )
    .min(1)
    .max(50),
  theaterName: z.string().min(1),
  industry: z.string().min(1),
});

// POST /api/leads/btob/score
export const btobScoreSchema = z.object({
  companies: z
    .array(
      z.object({
        name: z.string(),
        address: z.string(),
        corporateNumber: z.string(),
        capital: z.number().optional(),
        employeeCount: z.number().optional(),
        representativeName: z.string().optional(),
        websiteUrl: z.string().optional(),
        businessItems: z.array(z.string()).optional().default([]),
        subsidies: z.array(z.string()).optional().default([]),
      })
    )
    .min(1)
    .max(50),
  industry: z.string().min(1),
  area: z.string().min(1),
});

// POST /api/leads/recruit/score
export const recruitScoreSchema = z.object({
  places: z
    .array(
      z.object({
        name: z.string(),
        address: z.string(),
        phone: z.string(),
        rating: z.number(),
        ratingCount: z.number(),
        types: z.array(z.string()),
        mapsUrl: z.string(),
        websiteUrl: z.string(),
        businessStatus: z.string(),
        reviewSummary: z.string().optional(),
        placeSummary: z.string().optional(),
        neighborhoodSummary: z.string().optional(),
        googleMapsTypeLabel: z.string().optional(),
        isFutureOpening: z.boolean().optional(),
      })
    )
    .min(1)
    .max(50),
  industry: z.string().min(1),
  area: z.string().min(1),
});

// ================================================================
// Franchise Lead（加盟リード）
// ================================================================

// POST /api/franchise-leads/search
export const franchiseLeadSearchSchema = z.object({
  prefecture: z.string().min(1, "都道府県は必須です"),
  city: z.string().optional().default(""),
  businessType: z.string().min(1, "業種は必須です"),
  businessTypeKeywords: z.string().optional().default(""),
  count: z.number().int().min(1).max(50).optional().default(20),
});

// POST /api/franchise-leads/score
export const franchiseLeadScoreSchema = z.object({
  places: z
    .array(
      z.object({
        name: z.string(),
        address: z.string(),
        phone: z.string(),
        rating: z.number(),
        ratingCount: z.number(),
        types: z.array(z.string()),
        mapsUrl: z.string(),
        websiteUrl: z.string(),
        businessStatus: z.string(),
        reviewSummary: z.string().optional(),
        placeSummary: z.string().optional(),
        neighborhoodSummary: z.string().optional(),
        googleMapsTypeLabel: z.string().optional(),
        isFutureOpening: z.boolean().optional(),
      })
    )
    .min(1)
    .max(50),
  businessType: z.string().min(1),
  area: z.string().min(1),
});

// POST /api/franchise-leads/advise
export const franchiseLeadAdviseSchema = z.object({
  companyName: z.string().min(1),
  address: z.string(),
  businessType: z.string(),
  website: z.string().optional(),
  scoreComment: z.string().optional(),
  scoreTotal: z.number().optional(),
});
