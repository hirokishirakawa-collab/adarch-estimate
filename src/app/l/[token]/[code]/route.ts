// ==============================================================
// GET /l/[token]/[code] — 計測リンク（相手ごと）。クリックを記録して元URLへ転送
// LINEのリンクプレビュー用クローラ（line-poker / facebookexternalhit 等）は記録しない
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { recordLinkClick, resolveLinkUrl } from "@/lib/line/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRAWLER = /line-poker|facebookexternalhit|bot|crawler|spider|preview|slurp|headless/i;

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string; code: string }> }) {
  const { token, code } = await ctx.params;
  let decoded = code;
  try {
    decoded = decodeURIComponent(code);
  } catch {
    /* 既にデコード済み */
  }
  const ua = req.headers.get("user-agent") ?? "";
  const url = CRAWLER.test(ua) ? await resolveLinkUrl(token, decoded) : await recordLinkClick(token, decoded);
  if (!url) {
    return new NextResponse("このリンクは無効です。", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return NextResponse.redirect(url, 302);
}
