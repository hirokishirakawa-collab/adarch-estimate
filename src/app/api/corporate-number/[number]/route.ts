import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";

export const runtime = "nodejs";

/**
 * 国税庁 法人番号システム Web-API から法人名を取得
 * https://www.houjin-bangou.nta.go.jp/webapi/
 * API利用にはアプリケーションIDが必要（環境変数 NTA_APP_ID）
 * 未設定の場合はスクレイピングフォールバック
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { number } = await params;

  // バリデーション: 13桁の数字
  if (!/^\d{13}$/.test(number)) {
    return NextResponse.json({ error: "法人番号は13桁の数字で入力してください" }, { status: 400 });
  }

  const appId = process.env.NTA_APP_ID;

  if (appId) {
    // 国税庁 Web-API v4
    try {
      const url = `https://api.houjin-bangou.nta.go.jp/4/num?id=${appId}&number=${number}&type=02&history=0`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const text = await res.text();
        // CSV形式: ヘッダー行 + データ行
        const lines = text.trim().split("\n");
        if (lines.length >= 2) {
          const fields = lines[1].split(",");
          // 8番目のフィールドが法人名
          const name = fields[7]?.replace(/"/g, "").trim();
          if (name) {
            return NextResponse.json({ name, source: "nta-api" });
          }
        }
      }
    } catch (e) {
      console.error("[corporate-number] NTA API error:", e instanceof Error ? e.message : e);
    }
  }

  // フォールバック: 国税庁公表サイトのページをスクレイピング
  try {
    const url = `https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=${number}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "AdArchOS/1.0" },
    });
    if (res.ok) {
      const html = await res.text();
      // 法人名は <div class="data-value"> 内の最初の値
      const match = html.match(/商号又は名称<\/th>[^<]*<td[^>]*>([^<]+)<\/td>/);
      if (match?.[1]) {
        return NextResponse.json({ name: match[1].trim(), source: "nta-scrape" });
      }
    }
  } catch (e) {
    console.error("[corporate-number] Scrape error:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ error: "法人情報が見つかりませんでした", name: null }, { status: 404 });
}
