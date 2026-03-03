import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
    }

    // 画像をBase64に変換
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // MIMEタイプの決定
    const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
      return NextResponse.json(
        { error: "JPEG, PNG, GIF, WebP のいずれかの画像をアップロードしてください" },
        { status: 400 }
      );
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
                media_type: mediaType,
                data: base64,
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
  "url": "WebサイトURL"
}`,
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
        { error: "名刺情報の解析に失敗しました" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[OCR] Error:", e);
    return NextResponse.json(
      { error: "OCR処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
