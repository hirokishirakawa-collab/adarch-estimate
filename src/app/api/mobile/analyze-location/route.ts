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

interface LocationImage {
  base64: string;
  latitude: number;
  longitude: number;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit("mobile-api", "mobile/analyze-location", AI_RATE_LIMIT);
  if (limited) return limited;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  let body: { images?: LocationImage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { images } = body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return NextResponse.json(
      { error: "images は1件以上の配列で指定してください" },
      { status: 400 }
    );
  }

  try {
    const client = new Anthropic({ apiKey: anthropicApiKey });

    // 全画像をまとめてひとつのリクエストで分析
    const imageBlocks: Anthropic.ImageBlockParam[] = images.map((img) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: img.base64,
      },
    }));

    const locationSummary = images
      .map(
        (img, i) =>
          `写真${i + 1}: 緯度 ${img.latitude}, 経度 ${img.longitude}`
      )
      .join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `これらのロケハン写真を分析し、各写真について以下をJSON配列で返してください: shot_number, description(撮影場所の特徴を簡潔に), lighting(光の状態), space(広さ・収容), access(アクセス性), notes(撮影時の注意点)

JSONのみ返答してください。

【撮影位置情報】
${locationSummary}`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "ロケーション分析の解析に失敗しました" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ analyses: parsed });
  } catch (err) {
    console.error("[analyze-location] Error:", err);
    return NextResponse.json(
      { error: "ロケーション分析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
