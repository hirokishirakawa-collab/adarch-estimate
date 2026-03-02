export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";

export interface ScrapedAchievement {
  clientName:   string;
  prefecture:   string;
  industry:     string;
  videoType:    string;
  description:  string | null;
  referenceUrl: string | null;
}

// ---------------------------------------------------------------
// POST /api/scrape-works
// { url: string, productionCompany: string }
// ---------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI機能が設定されていません" }, { status: 500 });
  }

  let url: string;
  let productionCompany: string;
  try {
    const body = await req.json() as { url?: string; productionCompany?: string };
    url               = (body.url ?? "").trim();
    productionCompany = (body.productionCompany ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!url) return NextResponse.json({ error: "URLを入力してください" }, { status: 400 });

  // URLフェッチ
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AdArchBot/1.0; +https://ad-arch.net)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        return NextResponse.json(
          { error: `このサイトはアクセスをブロックしています（HTTP ${res.status}）。別のページURLを試してください。` },
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
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("timeout") || msg.includes("TimeoutError")) {
      return NextResponse.json(
        { error: "サイトの読み込みがタイムアウトしました。URLが正しいか確認してください。" },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: `サイトへのアクセスに失敗しました: ${msg}` }, { status: 422 });
  }

  // Cheerio でテキスト抽出
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();

  // 制作会社名を自動検出（未入力の場合）
  if (!productionCompany) {
    const title = $("title").first().text().trim();
    productionCompany = title
      ? title.split(/[|\-–—\/]/)[0].trim().slice(0, 60)
      : new URL(url).hostname.replace(/^www\./, "");
  }

  // ページ内テキストを収集（本文重視）
  const bodyText = $("main, article, section, .works, .case, .portfolio, #works, #case, body")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10000);

  // Claude AI で構造化
  const client = new Anthropic({ apiKey });

  const prompt = `【システム】
あなたは映像制作会社のWebサイトから「クライアント実績」を抽出する専門AIです。

【ルール】
1. 入力テキストから映像制作の「クライアント（発注元企業）」情報のみを抽出する
2. 制作会社自身の宣材・採用情報・会社概要は除外する
3. クライアント名が明確でない場合はスキップする
4. 業種: 食品・飲料 / 小売・EC / 不動産 / 建設・工事 / 医療・介護 / 教育 / 製造業 / IT・テクノロジー / 飲食店 / 美容・サロン / 観光・ホテル / 金融・保険 / 人材・採用 / 自動車 / アパレル / その他
5. videoType: TVCM / WEB_VIDEO / RECRUITMENT / EXHIBITION / SNS / CORPORATE / OTHER
6. prefecture: 「〇〇都/道/府/県」形式。不明は「不明」
7. 出力はJSONの配列のみ。前置き・コードブロック不要

【出力形式】
[
  {
    "clientName": "発注元企業名（例: 株式会社山田食品）",
    "prefecture": "神奈川県",
    "industry": "食品・飲料",
    "videoType": "WEB_VIDEO",
    "description": "制作内容の要約（なければnull）",
    "referenceUrl": "個別ページURLまたはYouTube URL（なければnull）"
  }
]

【制作会社】${productionCompany}
【参照URL】${url}

【ページテキスト】
${bodyText}`;

  try {
    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages:   [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "AIの応答が不正です" }, { status: 500 });
    }

    // JSON 部分だけ抽出（マークダウンコードブロック・前後テキストを除去）
    let raw = content.text.trim();
    // ```json ... ``` または ``` ... ``` を除去
    raw = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    // [ ... ] の範囲だけ切り出す
    const start = raw.indexOf("[");
    const end   = raw.lastIndexOf("]");
    if (start === -1 || end === -1) {
      console.error("[scrape-works] JSON array not found in response:", raw.slice(0, 200));
      return NextResponse.json({ productionCompany, items: [] });
    }
    const jsonStr = raw.slice(start, end + 1);

    let items: ScrapedAchievement[];
    try {
      items = JSON.parse(jsonStr) as ScrapedAchievement[];
    } catch (parseErr) {
      console.error("[scrape-works] JSON parse error:", parseErr, jsonStr.slice(0, 200));
      return NextResponse.json({ productionCompany, items: [] });
    }

    const valid = Array.isArray(items)
      ? items.filter((a) => a.clientName && a.clientName.length > 0)
      : [];

    return NextResponse.json({ productionCompany, items: valid });
  } catch (e) {
    console.error("[scrape-works] unexpected error:", e);
    return NextResponse.json({ error: "AI解析に失敗しました" }, { status: 500 });
  }
}
