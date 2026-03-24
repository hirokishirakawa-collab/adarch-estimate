import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "../_lib/verify-mobile-token";

export const runtime = "nodejs";

// No News/Announcement model exists in the schema yet.
// Return mock data until a proper model is added.
const MOCK_NEWS = [
  {
    id: "news-001",
    title: "システムメンテナンスのお知らせ",
    body: "2026年4月1日（水）深夜0:00〜2:00の間、システムメンテナンスを実施します。この時間帯はご利用いただけません。",
    category: "system",
    createdAt: "2026-03-20T09:00:00.000Z",
  },
  {
    id: "news-002",
    title: "新機能リリース：モバイルアプリ対応",
    body: "Ad Arch Group OSのモバイルアプリがリリースされました。見積確認・リード管理・社内Wikiへのアクセスがスマートフォンから可能になりました。",
    category: "product",
    createdAt: "2026-03-18T10:00:00.000Z",
  },
  {
    id: "news-003",
    title: "加盟条件改定のご案内（2026年4月〜）",
    body: "2026年4月より加盟条件が改定されます。詳細は社内Wikiの「加盟促進」カテゴリをご確認ください。",
    category: "important",
    createdAt: "2026-03-15T09:00:00.000Z",
  },
];

type NewsItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
};

export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const limitParam = searchParams.get("limit");
  const categoryParam = searchParams.get("category");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 50;

  let items: NewsItem[] = MOCK_NEWS;

  if (categoryParam) {
    items = items.filter((n) => n.category === categoryParam);
  }

  items = items.slice(0, limit);

  return NextResponse.json(items);
}
