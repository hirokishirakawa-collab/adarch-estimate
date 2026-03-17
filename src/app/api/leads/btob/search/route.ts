import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, btobSearchSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { BtoBCompanyLead } from "@/lib/constants/leads";

export const runtime = "nodejs";
export const maxDuration = 60;

// gBizINFO v1 API
const GBIZ_BASE = "https://info.gbiz.go.jp/hojin/v1/hojin";

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

const API_TOKEN = () => process.env.GBIZINFO_API_TOKEN ?? "";

const gbizHeaders = () => ({
  Accept: "application/json",
  "X-hojinInfo-api-token": API_TOKEN(),
});

// Step 1: Search by name/prefecture (returns basic info only)
async function searchCompanies(params: URLSearchParams): Promise<{ corporateNumbers: string[]; totalCount: number }> {
  const url = `${GBIZ_BASE}?${params.toString()}`;
  const res = await fetch(url, { headers: gbizHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`gBizINFO search error (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const infos: any[] = data["hojin-infos"] ?? [];
  return {
    corporateNumbers: infos.map((h: any) => h.corporate_number).filter(Boolean),
    totalCount: data["totalCount"] ?? infos.length,
  };
}

// Step 2: Get detail for a single company (returns full info)
async function getCompanyDetail(corporateNumber: string): Promise<BtoBCompanyLead | null> {
  try {
    const url = `${GBIZ_BASE}/${corporateNumber}`;
    const res = await fetch(url, { headers: gbizHeaders() });
    if (!res.ok) return null;

    const data = await res.json();
    const h = data["hojin-infos"]?.[0];
    if (!h) return null;

    return {
      name: h.name ?? "",
      address: h.location ?? "",
      corporateNumber: h.corporate_number ?? "",
      capital: h.capital_stock ? Number(h.capital_stock) : undefined,
      employeeCount: h.employee_number ? Number(h.employee_number) : undefined,
      representativeName: h.representative_name?.replace(/\s+/g, " ").trim() ?? undefined,
      websiteUrl: h.company_url ?? undefined,
      businessItems: h.business_summary ? [h.business_summary] : [],
      subsidies: Array.isArray(h.subsidies)
        ? h.subsidies.map((s: any) => typeof s === "string" ? s : (s.title ?? "")).filter(Boolean)
        : [],
    };
  } catch {
    return null;
  }
}

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

  if (!body.companyName && !body.prefecture && !body.businessItem) {
    return NextResponse.json(
      { error: "企業名、都道府県、または業種を指定してください" },
      { status: 400 }
    );
  }

  // 業種 → gBizINFO name検索用キーワードマッピング
  const INDUSTRY_SEARCH_KEYWORDS: Record<string, string> = {
    "製造業": "製造",
    "建設業": "建設",
    "情報通信業": "システム",
    "卸売業": "商事",
    "不動産業": "不動産",
    "運輸業": "運輸",
    "医療": "医療",
    "宿泊業": "ホテル",
    "教育": "学園",
    "サービス業": "サービス",
  };

  try {
    // Step 1: Search
    // gBizINFO v1は name + prefecture のみ対応
    // 業種はnameキーワードに変換して検索に組み込む
    const params = new URLSearchParams();

    const nameKeyword = body.companyName
      || (body.businessItem ? INDUSTRY_SEARCH_KEYWORDS[body.businessItem] ?? body.businessItem : "");
    if (nameKeyword) params.set("name", nameKeyword);

    if (body.prefecture) {
      const code = PREF_CODE_MAP[body.prefecture];
      if (code) params.set("prefecture", code);
    }
    // Fetch more than needed to allow post-filtering
    const fetchLimit = Math.min((body.limit ?? 20) * 3, 100);
    params.set("page", String(body.page ?? 1));
    params.set("limit", String(fetchLimit));

    const { corporateNumbers, totalCount } = await searchCompanies(params);

    if (corporateNumbers.length === 0) {
      return NextResponse.json({
        companies: [],
        totalCount: 0,
        page: body.page ?? 1,
        limit: body.limit ?? 20,
      });
    }

    // Step 2: Get details in parallel (max 20 concurrent)
    const batchSize = 20;
    let allDetails: (BtoBCompanyLead | null)[] = [];
    for (let i = 0; i < corporateNumbers.length; i += batchSize) {
      const batch = corporateNumbers.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(getCompanyDetail));
      allDetails = allDetails.concat(results);
    }

    let companies = allDetails.filter((c): c is BtoBCompanyLead => c !== null);

    // Step 3: Post-fetch filtering
    // 資本金・従業員数が未登録(undefined)の企業は除外せず残す
    if (body.capitalFrom !== undefined) {
      companies = companies.filter((c) => c.capital === undefined || c.capital >= body.capitalFrom!);
    }
    if (body.capitalTo !== undefined) {
      companies = companies.filter((c) => c.capital === undefined || c.capital <= body.capitalTo!);
    }
    if (body.employeeFrom !== undefined) {
      companies = companies.filter((c) => c.employeeCount === undefined || c.employeeCount >= body.employeeFrom!);
    }
    if (body.employeeTo !== undefined) {
      companies = companies.filter((c) => c.employeeCount === undefined || c.employeeCount <= body.employeeTo!);
    }
    // Note: businessItem filtering is already done via name search keyword
    // No additional post-fetch filter needed for businessItem

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
    const msg = err instanceof Error ? err.message : "企業検索中にエラーが発生しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
