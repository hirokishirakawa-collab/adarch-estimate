// ==============================================================
// GET /api/banner/tver?pref=佐賀県&city=唐津市&headline=...&sub=...
//   Meta広告などに使う訴求バナー（1200×628）を、OSの数字（市のTVer視聴者数・標準プランの到達人数・月額目安）から
//   「型」で描く。生成画像ではないので数字が狂わない。ブランドの決まり（墨×白・橙は一点）に沿う。
//   いまは SVG（下書き確認・LP埋め込み用）。Meta出稿には PNG が要るため、変換は次の段（sharp 導入時）。
//   公開（ログイン不要）: proxy.ts の除外に api/banner を追加済
// ==============================================================
import { NextRequest, NextResponse } from "next/server";
import { estimateArea, municipalitiesOf, prefectureOptions } from "@/lib/packages/tver-area";

export const runtime = "nodejs";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const fmt = (n: number) => Math.round(n).toLocaleString("ja-JP");

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pref = sp.get("pref") ?? "";
  const cityQ = sp.get("city") ?? "";
  if (!prefectureOptions().includes(pref)) return NextResponse.json({ error: "pref が不正です（例: 佐賀県）" }, { status: 400 });
  const munis = municipalitiesOf(pref);
  const city = munis.find((m) => m.name === cityQ || m.code === cityQ) ?? munis.find((m) => m.name.startsWith(cityQ));
  if (!city) return NextResponse.json({ error: "city が見つかりません" }, { status: 400 });
  const est = estimateArea(pref, city.code);
  if (!est) return NextResponse.json({ error: "プランを計算できません" }, { status: 400 });
  const headline = (sp.get("headline") ?? `${city.name}の3人に1人に、テレビCMを。`).slice(0, 40);
  const sub = (sp.get("sub") ?? "TVer（民放公式テレビ配信）で、商圏だけに15秒CMを流すエリア限定プラン").slice(0, 60);
  const p = est.plan;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628">
<style>text{font-family:'IBM Plex Sans JP','Hiragino Sans','Noto Sans JP',sans-serif}</style>
<rect width="1200" height="628" fill="#FFFFFF"/>
<rect x="72" y="84" width="40" height="4" fill="#F19834"/>
<text x="128" y="92" font-size="16" letter-spacing="3" fill="#6A6A6A">TVER LOCAL PLAN · ${esc(pref)} ${esc(city.name)}</text>
<text x="72" y="196" font-size="56" font-weight="600" fill="#111111">${esc(headline)}</text>
<text x="72" y="248" font-size="22" fill="#6A6A6A">${esc(sub)}</text>
<line x1="72" y1="300" x2="1128" y2="300" stroke="#111111" stroke-width="2"/>
<g font-size="16" fill="#6A6A6A">
  <text x="72" y="336">${esc(city.name)}のTVer視聴者</text>
  <text x="440" y="336">標準プランで届く人数</text>
  <text x="808" y="336">月額の目安（税抜）</text>
</g>
<g font-size="64" font-weight="600" fill="#111111">
  <text x="72" y="412">${fmt(p.viewers)}<tspan font-size="24"> 人</tspan></text>
  <text x="440" y="412">${fmt(p.reach)}<tspan font-size="24"> 人</tspan></text>
  <text x="808" y="412">¥${fmt(p.monthly)}<tspan font-size="24">〜</tspan></text>
</g>
<line x1="72" y1="448" x2="1128" y2="448" stroke="#E6E4E0" stroke-width="1"/>
<text x="72" y="484" font-size="15" fill="#6A6A6A">数字は市の人口とTVer視聴率からの推計。市区町村とプランを選ぶと確定額が出ます。</text>
<rect x="72" y="520" width="300" height="60" rx="4" fill="#F19834"/>
<text x="222" y="558" font-size="20" font-weight="600" fill="#111111" text-anchor="middle">エリア限定プランを見る</text>
<text x="1128" y="566" font-size="26" font-weight="600" fill="#111111" text-anchor="end" letter-spacing="-1">Ad Arch</text>
<text x="1128" y="590" font-size="12" fill="#6A6A6A" text-anchor="end">TVer広告 正規代理店</text>
</svg>`;
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
