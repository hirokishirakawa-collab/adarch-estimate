import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { companyName, senderName, targetType, serviceTypes, area } = body as {
    companyName: string;
    senderName: string;
    targetType: string;
    serviceTypes: string[];
    area?: string;
  };

  if (!companyName || !senderName || !targetType || !serviceTypes?.length) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }

  const serviceLabels: Record<string, string> = {
    VIDEO_PRODUCTION: "動画制作",
    SNS_MANAGEMENT: "SNS運用",
    AD_MEDIA: "広告媒体提案",
    FIRST_MEETING: "初回商談",
  };

  const services = serviceTypes.map((s) => serviceLabels[s] ?? s).join("・");
  const targetLabel = targetType === "BTOB" ? "法人（BtoB）" : "個人・店舗（BtoC）";

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `以下の条件で、問い合わせフォームに送る営業文を1つ作成してください。

送信元: ${companyName}（${senderName}）
ターゲット: ${targetLabel}
提供サービス: ${services}
${area ? `エリア: ${area}` : ""}

ルール:
- 200〜400文字程度
- 丁寧だが簡潔なビジネストーン
- 「突然のご連絡失礼いたします」で始める
- 具体的なサービス内容に触れる
- {industry}という変数を1箇所使う（送信時に営業先の業種名に自動置換される）
- 「まずはお気軽にご相談ください」的な締めくくり
- 営業文のみ出力（説明文不要）`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ pitchText: text.trim() });
}
