import { z } from "zod/v4";

// POST /api/leads/search
export const leadSearchSchema = z.object({
  prefecture: z.string().min(1, "都道府県は必須です"),
  city: z.string(),
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
