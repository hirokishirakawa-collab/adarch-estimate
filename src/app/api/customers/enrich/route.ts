export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { checkRateLimit, SCRAPE_RATE_LIMIT } from "@/lib/rate-limit";
import { safeFetch, SsrfError } from "@/lib/security/ssrf-guard";

// ---------------------------------------------------------------
// POST /api/customers/enrich
// { url } を受け取り、相手企業のサイトをクロール → AIで会社情報を抽出し、
// 顧客登録フォーム用の構造化データを返す。手打ちを無くすための補助。
// ---------------------------------------------------------------

export interface EnrichedCustomer {
  name: string;
  industry: string | null;
  prefecture: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  notes: string | null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const limited = checkRateLimit(session.user.email!, "customers-enrich", SCRAPE_RATE_LIMIT);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI機能が設定されていません" }, { status: 500 });
  }

  let url: string;
  try {
    const body = (await req.json()) as { url?: string };
    url = (body.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!url) return NextResponse.json({ error: "URLを入力してください" }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  // URLフェッチ（SSRFガード＝内部/プライベートIP・メタデータへの到達を遮断。
  // リダイレクトも手動追跡して各ホップを再検証）
  let html: string;
  try {
    const res = await safeFetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://ad-arch.net)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        return NextResponse.json(
          { error: `このサイトはアクセスをブロックしています（HTTP ${res.status}）。別のページURLをお試しください。` },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: `サイトの取得に失敗しました（HTTP ${res.status}）` },
        { status: 422 }
      );
    }
    html = await res.text();
  } catch (e) {
    // SSRFガードによる拒否は安全なメッセージをそのまま返す
    if (e instanceof SsrfError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("timeout") || msg.includes("TimeoutError")) {
      return NextResponse.json(
        { error: "サイトの読み込みがタイムアウトしました。URLをご確認ください。" },
        { status: 422 }
      );
    }
    // 生のfetchエラーは外部に出さない（内部情報の漏えい防止）
    console.error("[customers/enrich] fetch error:", msg);
    return NextResponse.json({ error: "サイトへのアクセスに失敗しました。URLをご確認ください。" }, { status: 422 });
  }

  // Cheerio でテキスト抽出
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, .menu, .navigation, .breadcrumb, .sidebar, #sidebar").remove();
  const title = $("title").first().text().trim();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 15000);

  const client = new Anthropic({ apiKey });

  const prompt = `あなたは企業Webサイトから「会社情報」を抽出する専門AIです。
顧客台帳に登録するための基本情報を、以下のテキストから読み取ってください。

【ルール】
1. name: 正式な会社名（株式会社などを含む）。会社概要・フッター・タイトルから判断
2. industry: 次から最も近いもの1つ。食品・飲料 / 小売・EC / 不動産 / 建設・工事 / 医療・介護 / 教育 / 製造業 / IT・テクノロジー / 飲食店 / 美容・サロン / 観光・ホテル / 金融・保険 / 人材・採用 / 自動車 / アパレル / 放送・メディア / 官公庁・自治体 / その他
3. prefecture: 所在地の都道府県を「〇〇都/道/府/県」形式で。不明はnull
4. address: 都道府県以降の住所（番地・ビル名まで）。不明はnull
5. phone: 代表電話番号（ハイフンあり）。不明はnull
6. email: 公開されている問い合わせメール。不明はnull
7. contactName: 代表者名（社長・代表）。分かれば。不明はnull
8. notes: 事業内容を30字程度で要約（広告提案の切り口になるよう、何を売っている会社かが分かる形で）
9. 推測で埋めず、テキストに無い項目はnullにする
10. 出力はJSONオブジェクトのみ。前置き・コードブロック不要

【出力形式】
{"name":"株式会社〇〇","industry":"建設・工事","prefecture":"東京都","address":"港区南青山1-1-1 〇〇ビル3F","phone":"03-1234-5678","email":"info@example.com","contactName":"山田太郎","notes":"注文住宅・リフォームを手がける工務店"}

【サイトタイトル】${title}
【参照URL】${url}

【ページテキスト】
${bodyText}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "AIの応答が不正です" }, { status: 500 });
    }

    let raw = content.text.trim();
    raw = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return NextResponse.json(
        { error: "会社情報を読み取れませんでした。別のページURLをお試しください。" },
        { status: 422 }
      );
    }

    let parsed: Partial<EnrichedCustomer>;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<EnrichedCustomer>;
    } catch {
      return NextResponse.json({ error: "会社情報の解析に失敗しました" }, { status: 422 });
    }

    const result: EnrichedCustomer = {
      name: (parsed.name ?? "").trim() || (title ? title.split(/[|\-–—/]/)[0].trim().slice(0, 60) : ""),
      industry: parsed.industry?.trim() || null,
      prefecture: parsed.prefecture?.trim() || null,
      address: parsed.address?.trim() || null,
      phone: parsed.phone?.trim() || null,
      email: parsed.email?.trim() || null,
      contactName: parsed.contactName?.trim() || null,
      notes: parsed.notes?.trim() || null,
    };

    return NextResponse.json({ customer: result, website: url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[customers/enrich] Error:", msg, e);
    // 生のエラー内容は外部に返さない（内部情報の漏えい防止）
    return NextResponse.json({ error: "AI処理に失敗しました。時間をおいてお試しください。" }, { status: 500 });
  }
}
