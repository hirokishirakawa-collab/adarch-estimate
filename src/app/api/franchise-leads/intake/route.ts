import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateBody, franchiseLeadIntakeSchema } from "@/lib/validations";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { resolveFranchiseAccess } from "@/lib/franchise-leads/access";
import { notifyCeo } from "@/lib/google-chat";

export const runtime = "nodejs";
export const maxDuration = 60;

// ----------------------------------------------------------------
// POST /api/franchise-leads/intake
// 窓口メール等の問い合わせ原文→AIが項目抽出→FranchiseLeadに起票
// 認証は2系統:
//   1. ADMINセッション（ダッシュボードのコピペ起票）
//   2. Bearer CRON_SECRET（GASの窓口メール自動起票。サーバー間）
// どちらも担当=null=本部で登録し、SLA監視対象になる
// ----------------------------------------------------------------

const CRON_SECRET = process.env.CRON_SECRET ?? "";

function isSystemCall(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return Boolean(CRON_SECRET) && auth === `Bearer ${CRON_SECRET}`;
}

const SYSTEM_PROMPT = `あなたはAd Arch株式会社の加盟問い合わせ管理アシスタントです。
貼り付けられたテキスト（フランチャイズの窓口の通知メール・紹介メール等）から、加盟検討者の情報を抽出してください。

【出力形式】以下のJSON形式のみで返答してください。不明な項目は null にする。推測で埋めない。
{
  "name": "検討者の氏名（敬称なし）",
  "company": "会社名・屋号（個人なら null）",
  "email": "メールアドレス",
  "phone": "電話番号",
  "prefecture": "都道府県（「宮城県」のような正式表記）",
  "businessType": "現在の事業内容・業種",
  "revenueRange": "年商規模（記載があれば）",
  "summary": "問い合わせ内容・検討状況の要約（100字以内）"
}`;

export async function POST(req: NextRequest) {
  const system = isSystemCall(req);
  if (!system) {
    const access = await resolveFranchiseAccess();
    if (!access?.isAdmin) {
      return NextResponse.json({ error: "この機能の利用権限がありません" }, { status: 403 });
    }
    const limited = checkRateLimit(access.email, "franchise-leads/intake", AI_RATE_LIMIT);
    if (limited) return limited;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  const parsed = await validateBody(req, franchiseLeadIntakeSchema);
  if (!parsed.success) return parsed.response;
  const { text } = parsed.data;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      thinking: { type: "disabled" },
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: text }],
    });

    const aiText = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIレスポンスのパースに失敗しました" }, { status: 500 });
    }

    const info = JSON.parse(jsonMatch[0]) as {
      name: string | null;
      company: string | null;
      email: string | null;
      phone: string | null;
      prefecture: string | null;
      businessType: string | null;
      revenueRange: string | null;
      summary: string | null;
    };

    if (!info.name && !info.company) {
      return NextResponse.json(
        { error: "氏名・会社名を読み取れませんでした。原文に含まれているかご確認ください" },
        { status: 422 }
      );
    }

    // 起票規約: companyName=「法人名（氏名）」or 氏名, address=メール（@@uniqueの重複防止キーとして流用）
    // ※7/3バックフィル分と同一形式（変更すると同一人物の重複起票になるため維持すること）
    const companyName =
      info.company && info.name
        ? `${info.company}（${info.name}）`
        : (info.company ?? info.name!);
    const address = info.email ?? info.phone ?? `WINDOW:${companyName}`;
    const notes = [info.summary ? `【要約】${info.summary}` : null, "―― 原文 ――", text]
      .filter(Boolean)
      .join("\n");

    // 複合キー完全一致に加え、companyNameの表記ゆれ（例:「法人名」vs「法人名（氏名）」）で
    // キーをすり抜ける二重起票を防ぐため、同一メール/電話（=address）のインバウンド既存行も重複とみなす
    const existing =
      (await db.franchiseLead.findUnique({
        where: { companyName_address: { companyName, address } },
      })) ??
      (await db.franchiseLead.findFirst({
        where: {
          source: { not: "OUTBOUND" },
          OR: [{ address }, ...(info.email ? [{ email: info.email }] : [])],
        },
        orderBy: { createdAt: "desc" },
      }));

    let lead;
    let duplicated = false;
    if (existing) {
      duplicated = true;
      const stamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      lead = await db.franchiseLead.update({
        where: { id: existing.id },
        data: {
          notes: `${existing.notes ?? ""}\n\n―― 再問い合わせ（${stamp}）――\n${text}`.trim(),
        },
      });
    } else {
      lead = await db.franchiseLead.create({
        data: {
          companyName,
          address,
          prefecture: info.prefecture,
          phone: info.phone,
          email: info.email,
          businessType: info.businessType,
          revenueRange: info.revenueRange,
          notes,
          source: "WINDOW",
          status: "NEW",
          // ownerEmail=null＝本部（インバウンドは本部担当。SLA監視対象）
        },
      });
    }

    // 自動起票（GAS経由）のときは代表へ即時Chat通知（手動コピペ時は画面で見えているため不要）
    if (system) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      await notifyCeo(
        [
          duplicated ? "🔁 窓口 再問い合わせ（自動起票）" : "🆕 窓口リード（自動起票）",
          `氏名: ${info.name ?? companyName}`,
          `都道府県: ${info.prefecture ?? "不明"}`,
          `事業内容: ${info.businessType ?? "不明"}`,
          `連絡先: ${info.email ?? ""}${info.phone ? ` / ${info.phone}` : ""}`,
          "",
          "⏰ SLA: 24時間以内に初回返信（v4下書き→PDF添付済ストックを使用）",
          appUrl ? `${appUrl}/dashboard/franchise-leads` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
    }

    return NextResponse.json({ lead, parsed: info, duplicated });
  } catch (err) {
    console.error("Franchise lead intake error:", err);
    return NextResponse.json({ error: "起票中にエラーが発生しました" }, { status: 500 });
  }
}
