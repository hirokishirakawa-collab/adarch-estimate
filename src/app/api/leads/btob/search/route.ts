import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, btobSearchSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { BtoBCompanyLead } from "@/lib/constants/leads";

export const runtime = "nodejs";
export const maxDuration = 30;

// gBizINFO v1 API (v2 is scheduled for later in 2026)
const GBIZ_API_BASE = "https://info.gbiz.go.jp/hojin/v1/hojin";

// 都道府県名 → JIS X 0401 コード
const PREF_CODE_MAP: Record<string, string> = {
  "北海道": "01", "青森県": "02", "岩手県": "03", "宮城県": "04", "秋田県": "05",
  "山形県": "06", "福島県": "07", "茨城県": "08", "栃木県": "09", "群馬県": "10",
  "埼玉県": "11", "千葉県": "12", "東京都": "13", "神奈川県": "14", "新潟県": "15",
  "富山県": "16", "石川県": "17", "福井県": "18", "山梨県": "19", "長野県": "20",
  "岐阜県": "21", "静岡県": "22", "愛知県": "23", "三重県": "24", "滋賀県": "25",
  "京都府": "26", "大阪府": "27", "兵庫県": "28", "奈良県": "29", "和歌山県": "30",
  "鳥取県": "31", "島根県": "32", "岡山県": "33", "広島県": "34", "山口県": "35",
  "徳島県": "36", "香川県": "37", "愛媛県": "38", "高知県": "39", "福岡県": "40",
  "佐賀県": "41", "長崎県": "42", "熊本県": "43", "大分県": "44", "宮崎県": "45",
  "鹿児島県": "46", "沖縄県": "47",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email!, "leads/btob/search", AI_RATE_LIMIT);
  if (limited) return limited;

  const parsed = await validateBody(req, btobSearchSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // At least one search criterion is required
  if (!body.companyName && !body.prefecture && !body.businessItem) {
    return NextResponse.json(
      { error: "企業名、都道府県、または業種のいずれかを指定してください" },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams();
    if (body.companyName) params.set("name", body.companyName);
    if (body.prefecture) {
      const code = PREF_CODE_MAP[body.prefecture];
      if (code) params.set("prefecture", code);
    }
    // v1 API: name, prefecture, page, limit are the main search params
    // capital_stock, employee_number, business_item filters are applied post-fetch
    params.set("page", String(body.page ?? 1));
    params.set("limit", String(Math.min((body.limit ?? 20) * 3, 100))); // fetch more to allow post-filtering

    const url = `${GBIZ_API_BASE}?${params.toString()}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const apiToken = process.env.GBIZINFO_API_TOKEN;
    if (apiToken) {
      headers["X-hojinInfo-api-token"] = apiToken;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[btob/search] gBizINFO error:", res.status, url, text);
      return NextResponse.json(
        { error: `gBizINFO APIエラー (${res.status}): ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const rawText = await res.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("[btob/search] gBizINFO non-JSON response:", rawText.slice(0, 500));
      return NextResponse.json(
        { error: `gBizINFO APIが不正なレスポンスを返しました`, debug: { url, status: res.status, body: rawText.slice(0, 300) } },
        { status: 502 }
      );
    }

    console.log("[btob/search] gBizINFO response keys:", Object.keys(data), "url:", url);

    const hojinInfos: any[] = data["hojin-infos"] ?? [];
    const totalCount: number = data["totalCount"] ?? hojinInfos.length;

    // Debug: if empty, return the raw response structure
    if (hojinInfos.length === 0) {
      console.log("[btob/search] Empty result. Full response:", JSON.stringify(data).slice(0, 500));
    }

    // Map to BtoBCompanyLead
    let companies: BtoBCompanyLead[] = hojinInfos.map((h: any) => ({
      name: h.name ?? "",
      address: h.location ?? "",
      corporateNumber: h.corporate_number ?? "",
      capital: h.capital_stock ? Number(h.capital_stock) : undefined,
      employeeCount: h.employee_number ? Number(h.employee_number) : undefined,
      representativeName: h.representative_name ?? undefined,
      websiteUrl: h.company_url ?? undefined,
      businessItems: Array.isArray(h.business_items)
        ? h.business_items.map((bi: any) => typeof bi === "string" ? bi : (bi.business_item ?? "")).filter(Boolean)
        : [],
      subsidies: Array.isArray(h.subsidies)
        ? h.subsidies.map((s: any) => typeof s === "string" ? s : (s.title ?? s.subsidy_name ?? "")).filter(Boolean)
        : [],
    }));

    // Post-fetch filtering (v1 doesn't support these as query params)
    if (body.capitalFrom !== undefined) {
      companies = companies.filter((c) => c.capital !== undefined && c.capital >= body.capitalFrom!);
    }
    if (body.capitalTo !== undefined) {
      companies = companies.filter((c) => c.capital !== undefined && c.capital <= body.capitalTo!);
    }
    if (body.employeeFrom !== undefined) {
      companies = companies.filter((c) => c.employeeCount !== undefined && c.employeeCount >= body.employeeFrom!);
    }
    if (body.employeeTo !== undefined) {
      companies = companies.filter((c) => c.employeeCount !== undefined && c.employeeCount <= body.employeeTo!);
    }
    if (body.businessItem) {
      const keyword = body.businessItem.toLowerCase();
      companies = companies.filter((c) =>
        c.businessItems.some((bi) => bi.toLowerCase().includes(keyword)) ||
        c.name.toLowerCase().includes(keyword)
      );
    }

    // Limit to requested count
    const requestedLimit = body.limit ?? 20;
    companies = companies.slice(0, requestedLimit);

    return NextResponse.json({
      companies,
      totalCount,
      page: body.page ?? 1,
      limit: requestedLimit,
    });
  } catch (err) {
    console.error("[btob/search] error:", err);
    return NextResponse.json(
      { error: "企業検索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
