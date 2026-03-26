import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

export const runtime = "nodejs";

// モバイルアプリからの認証: Bearer トークン or x-api-key ヘッダーで検証
function checkAuth(req: NextRequest): boolean {
  const apiKey = process.env.GROUP_SUPPORT_API_KEY;
  if (!apiKey) return false;

  // Bearer トークン
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === apiKey) {
    return true;
  }

  // x-api-key ヘッダー
  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey && xApiKey === apiKey) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit("mobile-api", "mobile/scan-signboard", AI_RATE_LIMIT);
  if (limited) return limited;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  let body: { imageBase64?: string; latitude?: number; longitude?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { imageBase64, latitude, longitude } = body;

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 は必須です" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey: anthropicApiKey });

    const locationNote =
      latitude != null && longitude != null
        ? `\n\n※ 撮影位置情報: 緯度 ${latitude}, 経度 ${longitude}`
        : "";

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `この看板の写真から以下の情報を抽出してJSON形式で返してください: company_name(企業名), industry(業種), address(住所・推定), phone(電話番号), website(ウェブサイト), score(広告出稿見込みスコア 0-100), notes(特記事項)

読み取れないフィールドは null にしてください。JSONのみ返答してください。${locationNote}`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "看板情報の解析に失敗しました" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[scan-signboard] Error:", err);
    return NextResponse.json(
      { error: "看板スキャン処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
