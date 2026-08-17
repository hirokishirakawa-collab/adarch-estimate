import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// アドアーチグループで効果が確認されている参考文
const REFERENCE_PITCH = `茨城県水戸市を拠点に映像制作をしているFUJIYAMA STUDIO代表 山口 亜弓と申します。

このたび4月にオープンされる「みと好文テラス」の存在を知り、映像まわりで何かお力になれることがあればと思いご連絡いたしました。

弊社が、TVerやイオンシネマなどの正規広告代理店としてのPR提供、SNSでの魅力発信なども取り組んでおります。

地元水戸にお力添えできればと考えているのですが、一度お打ち合わせいかがでしょうか`;

// 実績ベースで営業文を AI 生成（実績が少なくても参考文ベースで生成可能）
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { targetType, industry } = body as {
    targetType: string;
    industry?: string;
  };

  if (!targetType) {
    return NextResponse.json({ error: "targetType は必須です" }, { status: 400 });
  }

  // ── 成功実績を収集 ──

  // 1. SalesApproach（手動共有の成功事例）
  const approachFilter: Record<string, unknown> = {
    result: { in: ["DEAL", "REPLIED_NG"] },
  };
  if (industry) {
    approachFilter.industry = { contains: industry, mode: "insensitive" };
  }

  const successApproaches = await db.salesApproach.findMany({
    where: approachFilter,
    select: {
      industry: true,
      method: true,
      messageBody: true,
      result: true,
      learnings: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // 2. AutoSalesJob（自動営業の反響データ）
  const jobFilter: Record<string, unknown> = {
    hasResponse: true,
    status: "COMPLETED",
  };
  if (industry) {
    jobFilter.target = { industry: { contains: industry, mode: "insensitive" } };
  }

  const successJobs = await db.autoSalesJob.findMany({
    where: jobFilter,
    select: {
      responseNote: true,
      responseSnippet: true,
      template: {
        select: { pitchText: true, targetType: true, serviceTypes: true },
      },
      target: {
        select: { industry: true, area: true },
      },
    },
    orderBy: { respondedAt: "desc" },
    take: 10,
  });

  // 3. 実績が少ない場合: 全テンプレートの訴求文も参考にする
  let templateExamples = "";
  if (successApproaches.length + successJobs.length < 3) {
    const templates = await db.autoSalesTemplate.findMany({
      where: { isActive: true },
      select: { pitchText: true, targetType: true, serviceTypes: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (templates.length > 0) {
      templateExamples = templates
        .map((t, i) => `【運用中テンプレ${i + 1}】${t.pitchText.substring(0, 300)}`)
        .join("\n\n");
    }
  }

  // ── 実績をプロンプト用テキストに組み立て ──
  const approachExamples = successApproaches
    .map(
      (a, i) =>
        `【事例${i + 1}】結果: ${a.result === "DEAL" ? "商談化" : "返信あり"} / 業種: ${a.industry} / 方法: ${a.method}\n文面:\n${a.messageBody.substring(0, 400)}${a.learnings ? `\n学び: ${a.learnings.substring(0, 150)}` : ""}`
    )
    .join("\n\n");

  const jobExamples = successJobs
    .map(
      (j, i) =>
        `【自動営業${i + 1}】業種: ${j.target.industry ?? "不明"} / エリア: ${j.target.area ?? "不明"}\n訴求文: ${j.template.pitchText.substring(0, 300)}${j.responseSnippet ? `\n先方反応: ${j.responseSnippet.substring(0, 100)}` : ""}`
    )
    .join("\n\n");

  const totalExamples = successApproaches.length + successJobs.length;
  const targetLabel = targetType === "BTOB" ? "法人（BtoB）" : "個人・店舗（BtoC）";
  const senderName = user.name?.trim() || session.user.email.split("@")[0];

  // ── データ量に応じてプロンプトを構築 ──
  let dataSection = "";

  if (approachExamples) {
    dataSection += `【手動営業の成功事例】\n${approachExamples}\n\n`;
  }
  if (jobExamples) {
    dataSection += `【自動営業の反響実績】\n${jobExamples}\n\n`;
  }
  if (templateExamples) {
    dataSection += `【現在運用中の営業テンプレート】\n${templateExamples}\n\n`;
  }

  // 参考文は常に含める
  dataSection += `【アドアーチグループで実際に反応が良かった営業文のお手本】\n${REFERENCE_PITCH}\n`;

  const dataLabel =
    totalExamples > 0
      ? `${totalExamples}件の実績データ + グループ参考文から生成`
      : "グループ参考文 + 運用テンプレートから生成";

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `あなたはアドアーチグループ加盟パートナー「${senderName}」本人として営業文を作成します。
以下のデータを元に、最も効果的な営業文テンプレートを1つ作成してください。

【条件】
- 差出人（自己紹介で名乗る名前）: ${senderName}
- ターゲット: ${targetLabel}
${industry ? `- 業種: ${industry}` : "- 業種: 指定なし（汎用）"}

【アドアーチグループの強み（営業文に自然に組み込むこと）】
- 正規広告代理店として TVer・イオンシネマ・タクシー広告・ゴルフカート広告 等の独自媒体枠を保有
- 動画制作（15秒〜30秒の広告動画）
- SNS運用・YouTube チャンネル運用
- 地方の事業を全国的にPR
- ターゲットの業種に合った媒体を具体名で1〜2つ挙げる

${dataSection}

【出力形式】
以下の2つを出力してください。区切りに「---APPROACH---」を使用。

1. 営業文テンプレート（150〜250文字）
- お手本の営業文のトーンと構成を参考にする（自己紹介→相手への関心→提供サービス→打ち合わせ提案）
- 冒頭の自己紹介では必ず「${senderName}」という実名で名乗ること（「営業コンサルタント」「担当者」等の役職名で名乗らない）
${totalExamples > 0 ? "- 成功事例のパターンも踏襲する" : ""}
- 使ってよい変数は {industry}（相手の業種）と {area}（相手のエリア）だけ。
  {companyInsight} は廃止済みなので使わない
- 自然体で堅すぎないトーン。ただし「拝見し」「お力になれれば」のような、
  営業フォームで使い古された言い回しは避ける（受け手に定型文だと分かるため）
- 相手を褒める書き出しにしない
- 地域密着感を出す
- クライアント名や他社実績には絶対に言及しない

---APPROACH---

2. この営業文のポイント（50〜100文字）
- なぜこの構成・トーンが効果的なのかを1〜2行で

営業文とポイントのみ出力（説明や補足は不要）。`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const parts = text.split("---APPROACH---");
  const pitchText = parts[0]?.trim() ?? "";
  const approach = parts[1]?.trim() ?? "";

  return NextResponse.json({
    pitchText,
    approach,
    exampleCount: totalExamples,
    dataLabel,
    message: null,
  });
}
