import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email!, "mobile/business-cards/ocr", AI_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  try {
    const { imageBase64 } = await request.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 が必要です" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
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
              text: `この名刺画像から情報を読み取り、以下のJSON形式で返してください。読み取れないフィールドはnullにしてください。他の文字は不要です。

{
  "companyName": "会社名",
  "department": "部署名",
  "title": "役職",
  "lastName": "姓",
  "firstName": "名",
  "email": "メールアドレス",
  "companyPhone": "会社電話番号",
  "directPhone": "直通電話番号",
  "mobilePhone": "携帯電話番号",
  "fax": "FAX番号",
  "postalCode": "郵便番号",
  "address": "住所",
  "url": "WebサイトURL",
  "prefecture": "都道府県（住所から推定）"
}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: "名刺情報の解析に失敗しました" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[Mobile OCR] Error:", e);
    return NextResponse.json({ error: "OCR処理中にエラーが発生しました" }, { status: 500 });
  }
}
