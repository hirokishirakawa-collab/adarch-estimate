import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "../../_lib/verify-mobile-token";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { normalizeCompanyName } from "@/lib/leads/match-score";

export const runtime = "nodejs";
export const maxDuration = 120;

interface LeadCandidate {
  name: string;
  address?: string;
  phone?: string;
  rating?: number;
  ratingCount?: number;
  types?: string[];
  mapsUrl?: string;
  websiteUrl?: string;
  businessStatus?: string;
}

// ----------------------------------------------------------------
// POST /api/mobile/leads/score
// AI scoring of lead candidates using Anthropic API
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(user.email ?? "mobile", "mobile/leads/score", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: {
    leads?: LeadCandidate[];
    industry?: string;
    area?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.leads || !Array.isArray(body.leads) || body.leads.length === 0) {
    return NextResponse.json(
      { error: "leads array is required and must not be empty" },
      { status: 400 }
    );
  }

  if (body.leads.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 leads per request" },
      { status: 400 }
    );
  }

  const industry = body.industry || "general";
  const area = body.area || "unknown";

  // 既存リード・顧客の照合
  const allNames = body.leads.map((l) => l.name);
  const [existingLeads, existingCustomers] = await Promise.all([
    db.lead.findMany({
      where: { name: { in: allNames } },
      select: { name: true, status: true, scoreTotal: true },
    }).catch(() => [] as { name: string; status: string; scoreTotal: number }[]),
    db.customer.findMany({
      where: { name: { in: allNames } },
      select: { name: true, status: true },
    }).catch(() => [] as { name: string; status: string }[]),
  ]);

  const existingMap = new Map<string, string>();
  const normalizedExisting = new Map<string, string>();
  for (const l of existingLeads) {
    const tag = `Existing lead (${l.status}, score ${l.scoreTotal})`;
    existingMap.set(l.name, tag);
    normalizedExisting.set(normalizeCompanyName(l.name), tag);
  }
  for (const c of existingCustomers) {
    const tag = `Existing customer (${c.status})`;
    existingMap.set(c.name, tag);
    normalizedExisting.set(normalizeCompanyName(c.name), tag);
  }
  function getExistingTag(name: string): string | undefined {
    return existingMap.get(name) ?? normalizedExisting.get(normalizeCompanyName(name));
  }

  const SYSTEM_PROMPT = `You are a sales support AI for Ad Arch Group.
Score each business lead for advertising sales potential.

Scoring criteria (100 points total):
1. Industry match (25pts): How well the business matches the target industry
2. Activity level (15pts): Business activity based on reviews/ratings
3. Scale (15pts): Business size, multi-location, hiring pages
4. Competitive advantage (15pts): Whether Ad Arch strengths (video production, OOH ads) apply
5. Accessibility (10pts): Phone availability, operational status
6. Digital presence (20pts): Opportunity for digital marketing proposals (low digital = high opportunity)

If a lead is marked with "⚠️Existing lead" or "⚠️Existing customer", mention this in the comment and warn about duplicate outreach.

Use the output_scores tool to return results.
[
  {
    "name": "Business Name",
    "total": 78,
    "breakdown": {
      "industryMatch": 22,
      "activity": 12,
      "scale": 12,
      "competitive": 10,
      "accessibility": 7,
      "digitalPresence": 15
    },
    "comment": "Brief sales approach suggestion"
  }
]`;

  function formatLead(p: LeadCandidate, i: number) {
    const existingInfo = getExistingTag(p.name);
    const existTag = existingInfo ? ` | ⚠️${existingInfo}` : "";
    return `${i + 1}. ${p.name} | ${p.address ?? "N/A"} | Phone:${p.phone || "none"} | Rating:${p.rating ?? 0}(${p.ratingCount ?? 0} reviews) | Status:${p.businessStatus ?? "N/A"} | Types:${(p.types ?? []).slice(0, 5).join(",")} | Web:${p.websiteUrl || "none"}${existTag}`;
  }

  const SCORE_TOOLS = [{
    name: "output_scores" as const,
    description: "Score output tool",
    input_schema: {
      type: "object" as const,
      properties: {
        scores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              total: { type: "number" },
              breakdown: {
                type: "object",
                properties: {
                  industryMatch: { type: "number" },
                  activity: { type: "number" },
                  scale: { type: "number" },
                  competitive: { type: "number" },
                  accessibility: { type: "number" },
                  digitalPresence: { type: "number" },
                },
                required: ["industryMatch", "activity", "scale", "competitive", "accessibility", "digitalPresence"],
              },
              comment: { type: "string" },
            },
            required: ["name", "total", "breakdown", "comment"],
          },
        },
      },
      required: ["scores"],
    },
  }];

  // 分割並列スコアリング（15件以上は分割して並列実行）
  const BATCH_SIZE = 15;
  const indices = body.leads.map((_, i) => i);
  const batches: number[][] = [];
  for (let i = 0; i < indices.length; i += BATCH_SIZE) {
    batches.push(indices.slice(i, i + BATCH_SIZE));
  }

  try {
    const client = new Anthropic({ apiKey });

    async function scoreBatch(batchIndices: number[]) {
      const batchSummary = batchIndices
        .map((i, j) => formatLead(body.leads![i], j))
        .join("\n");

      const userMessage = `Industry: ${industry}
Area: ${area}

Leads:
${batchSummary}

Score these leads.`;

      const response = await client.messages.create({
        model: "claude-sonnet-5",
        thinking: { type: "disabled" },
        max_tokens: 4096,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: userMessage }],
        tools: SCORE_TOOLS,
        tool_choice: { type: "tool", name: "output_scores" },
      });

      const toolBlock = response.content.find(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );
      if (!toolBlock) return [];
      return (toolBlock.input as { scores: unknown[] }).scores;
    }

    // 並列実行してマージ
    const batchResults = await Promise.all(batches.map(scoreBatch));
    const scores = batchResults.flat();

    return NextResponse.json({ scores });
  } catch (err) {
    console.error("[POST /api/mobile/leads/score]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
