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
        content: `以下の条件と参考文を元に、問い合わせフォームに送る営業文を1つ作成してください。

送信元: ${companyName}（${senderName}）
ターゲット: ${targetLabel}
提供サービス: ${services}
${area ? `エリア: ${area}` : ""}

【参考文（このトーンと構成を真似すること）】
---
茨城県水戸市を拠点に映像制作をしているFUJIYAMA STUDIO代表 山口 亜弓と申します。

このたび4月にオープンされる「みと好文テラス」の存在を知り、映像まわりで何かお力になれることがあればと思いご連絡いたしました。

弊社が、TVerやイオンシネマなどの正規広告代理店としてのPR提供、SNSでの魅力発信なども取り組んでおります。

地元水戸にお力添えできればと考えているのですが、一度お打ち合わせいかがでしょうか
---

ルール:
- 150〜250文字程度（短く簡潔に）
- 参考文のように自然体で、堅すぎないトーン
- 自己紹介→相手への関心→提供できること→打ち合わせの提案、の流れ
- {industry}という変数を1箇所使う（送信時に営業先の業種名に自動置換される）
- 営業文のみ出力（説明文や補足は不要）`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ pitchText: text.trim() });
}
