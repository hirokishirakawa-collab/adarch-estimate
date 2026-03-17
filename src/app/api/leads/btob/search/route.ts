import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateBody, btobSearchSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { BtoBCompanyLead } from "@/lib/constants/leads";

export const runtime = "nodejs";
export const maxDuration = 30;

// gBizINFO v2 API base
const GBIZ_API_BASE = "https://info.gbiz.go.jp/hojin/v2/hojin";

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

  try {
    // Build query params for gBizINFO API
    const params = new URLSearchParams();
    if (body.companyName) params.set("name", body.companyName);
    if (body.prefecture) params.set("prefecture", body.prefecture);
    if (body.city) params.set("city", body.city);
    if (body.businessItem) params.set("business_item", body.businessItem);
    if (body.capitalFrom !== undefined) params.set("capital_stock_from", String(body.capitalFrom));
    if (body.capitalTo !== undefined) params.set("capital_stock_to", String(body.capitalTo));
    if (body.employeeFrom !== undefined) params.set("employee_number_from", String(body.employeeFrom));
    if (body.employeeTo !== undefined) params.set("employee_number_to", String(body.employeeTo));
    params.set("page", String(body.page ?? 1));
    params.set("limit", String(body.limit ?? 20));

    const url = `${GBIZ_API_BASE}?${params.toString()}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    // gBizINFO v2 uses X-hojinInfo-api-token header for auth
    const apiToken = process.env.GBIZINFO_API_TOKEN;
    if (apiToken) {
      headers["X-hojinInfo-api-token"] = apiToken;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[btob/search] gBizINFO error:", res.status, text);
      return NextResponse.json(
        { error: `gBizINFO APIエラー (${res.status})` },
        { status: 502 }
      );
    }

    const data = await res.json();

    // gBizINFO response: { "hojin-infos": [...], "totalCount": N, ... }
    const hojinInfos: any[] = data["hojin-infos"] ?? [];
    const totalCount: number = data["totalCount"] ?? 0;

    const companies: BtoBCompanyLead[] = hojinInfos.map((h: any) => ({
      name: h.name ?? "",
      address: h.location ?? "",
      corporateNumber: h.corporate_number ?? "",
      capital: h.capital_stock ? Number(h.capital_stock) : undefined,
      employeeCount: h.employee_number ? Number(h.employee_number) : undefined,
      representativeName: h.representative_name ?? undefined,
      websiteUrl: h.company_url ?? undefined,
      businessItems: Array.isArray(h.business_items)
        ? h.business_items.map((bi: any) => bi.business_item ?? "").filter(Boolean)
        : [],
      subsidies: Array.isArray(h.subsidies)
        ? h.subsidies.map((s: any) => s.title ?? s.subsidy_name ?? "").filter(Boolean)
        : [],
    }));

    return NextResponse.json({
      companies,
      totalCount,
      page: body.page ?? 1,
      limit: body.limit ?? 20,
    });
  } catch (err) {
    console.error("[btob/search] error:", err);
    return NextResponse.json(
      { error: "企業検索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
