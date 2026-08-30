// 本部チラシ制作サポート — A4縦チラシのHTML（Chrome headless でPDF化）
// デザイン言語は TVer資料デッキ（~/Desktop/05_媒体・提案資料/TVer販売説明資料_2026-08/_source/tver_deck.html）と同じ:
//   紙色 #FBFAF5 ／ ネイビー #1B3A5C ／ ゴールド #C9A961 ／ Noto Sans JP（見出し900）
import path from "path";
import type { FlyerData } from "@/lib/tver/flyer-data";

const NAVY = "#1B3A5C";
const GOLD = "#C9A961";
const PAPER = "#FBFAF5";
const INK = "#243746";
const MUTE = "#8A94A0";
const LINE = "#E3DECF";

const fontDir = path.join(process.cwd(), "public/fonts");
const fontUrl = (f: string) => "file://" + path.join(fontDir, f);
const logoUrl = "file://" + path.join(process.cwd(), "public/logo-adarch.png");

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const man = (n: number) => (n >= 10_000 ? `${(n / 10_000).toFixed(1)}<small>万人</small>` : `${Math.round(n).toLocaleString("ja-JP")}<small>人</small>`);
const manPlain = (n: number) => (n >= 10_000 ? `${(n / 10_000).toFixed(1)}万人` : `${Math.round(n).toLocaleString("ja-JP")}人`);
const yen = (n: number) => `<small>¥</small>${Math.round(n).toLocaleString("ja-JP")}`;
const yenPlain = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const num = (n: number) => n.toLocaleString("ja-JP");
const fmtDate = (d: Date) => new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(d);

/** 到達率のリング（SVG） */
function ring(pct: number): string {
  const r = 54;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const dash = (c * p) / 100;
  return `
<svg class="ring" viewBox="0 0 140 140" width="118" height="118" aria-hidden="true">
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="14"/>
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="${GOLD}" stroke-width="14" stroke-linecap="butt"
    stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" transform="rotate(-90 70 70)"/>
  <text x="70" y="66" text-anchor="middle" fill="#fff" font-size="27" font-weight="700" font-family="Noto Sans JP">${p.toFixed(1)}<tspan font-size="14">%</tspan></text>
  <text x="70" y="88" text-anchor="middle" fill="#B9C7D6" font-size="10" letter-spacing="1">到達率</text>
</svg>`;
}

export function buildFlyerHtml(d: FlyerData): string {
  const multi = d.municipalityNames.length > 1;
  const cov = d.coverage;
  const secLabel = `${d.seconds}秒CM`;
  const areaDesc = multi
    ? `${esc(d.prefName)} ${esc(d.municipalityNames.join("・"))}（合計人口 ${num(d.population)}人）`
    : `${esc(d.prefName)}${esc(d.areaLabel)}（人口 ${num(d.population)}人）`;
  const catchCopy = (d.catchCopy ?? "テレビ番組を見ているその時間に、\n地元の会社として名前を届けます。\nまず商圏を決めるところから、ご一緒します。")
    .split(/\n+/).map((l) => esc(l.trim())).filter(Boolean).join("<br>");
  const issuerIsGroup = d.issuerName === "Ad Archグループ";

  const bullets = [
    ["01", "3人に1人へ、月平均約5回", `${multi ? "商圏内" : "市内"}のTVer視聴者の3人に1人に、ひと月に平均約5回お届けします。`],
    ["02", "標準3ヶ月で、認知を取り切る", "単月で判断せず、3ヶ月続けて商圏での認知を取り切ってから効果を見ます。"],
    ["03", "テレビ画面にも届く", "スマホ・PCに加え、テレビ画面（コネクテッドTV）で番組と同じ品質で流れます。"],
    ["04", "最寄りの担当が対面で伴走", "企画から配信・報告まで、地元の担当が直接お伺いして進めます。"],
  ];

  const neighborRows = d.neighbors.map((n) => `
      <tr><td class="tl">${esc(n.areaLabel)}</td><td>${num(n.population)}人</td><td>${manPlain(n.viewers)}</td><td class="em">${yenPlain(n.monthly)}</td></tr>`).join("");

  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<title>${esc(d.areaLabel)}を、まるごと。</title>
<style>
@font-face { font-family:"Noto Sans JP"; font-weight:400; src:url("${fontUrl("NotoSansJP-Regular.ttf")}") format("truetype"); }
@font-face { font-family:"Noto Sans JP"; font-weight:700; src:url("${fontUrl("NotoSansJP-Bold.ttf")}") format("truetype"); }
@font-face { font-family:"Noto Sans JP"; font-weight:900; src:url("${fontUrl("NotoSansJP-Bold.ttf")}") format("truetype"); }
@page { size:210mm 297mm; margin:0; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:210mm; height:297mm; }
body { background:${PAPER}; color:${INK}; font-family:"Noto Sans JP","Noto Sans CJK JP","Hiragino Sans",sans-serif;
  -webkit-font-smoothing:antialiased; font-size:10.5px; line-height:1.6; word-break:auto-phrase; overflow-wrap:anywhere; }
.sheet { position:relative; width:210mm; height:297mm; overflow:hidden; padding:15mm 16mm 14mm 20mm; }
.bar { position:absolute; left:0; top:0; width:5mm; height:100%; background:${NAVY}; }
.bar::after { content:""; position:absolute; left:0; top:0; width:5mm; height:38%; background:${GOLD}; }
small { font-size:.55em; font-weight:700; margin:0 .08em; }

/* 上段 */
.top { display:flex; justify-content:space-between; align-items:flex-start; }
.issuer b { display:block; font-size:14px; font-weight:700; color:${NAVY}; letter-spacing:.02em; }
.issuer span { display:block; font-size:8.5px; color:${MUTE}; letter-spacing:.14em; margin-top:2px; }
.grp { text-align:right; }
.grp img { height:16px; display:block; margin-left:auto; }
.grp span { display:block; font-size:8px; letter-spacing:.24em; color:${GOLD}; font-weight:700; margin-top:5px; }
.client { font-size:13px; font-weight:700; color:${INK}; margin-top:18px; }

/* 見出し */
.eyebrow { font-size:9px; font-weight:700; letter-spacing:.26em; color:${GOLD}; margin-top:16px; }
h1 { font-size:40px; font-weight:900; line-height:1.18; letter-spacing:-.01em; color:${NAVY}; margin-top:6px; }
.rule { width:44px; height:3px; background:${GOLD}; margin-top:10px; }
.lead { font-size:10.5px; line-height:1.7; color:#4A5A68; margin-top:10px; max-width:150mm; }

/* KPI */
.kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:13px; }
.kpi { background:#fff; border-top:3px solid ${LINE}; padding:12px 12px 10px; box-shadow:0 1px 3px rgba(27,58,92,.07); }
.kpi.g { border-top-color:${GOLD}; }
.kpi b { display:block; font-size:22px; font-weight:900; color:${NAVY}; letter-spacing:-.02em; line-height:1.1; white-space:nowrap; }
.kpi span { display:block; font-size:8.3px; color:${MUTE}; margin-top:6px; letter-spacing:.02em; }

/* 到達率 */
.cov { display:flex; align-items:center; gap:16px; background:${NAVY}; color:#fff; margin-top:10px; padding:10px 20px; }
.cov .ring { flex:none; }
.cov p { font-size:14px; line-height:1.6; font-weight:400; }
.cov p b { color:#E6C97A; font-weight:700; }
.cov em { display:block; font-style:normal; font-size:9px; color:#B9C7D6; margin-top:6px; letter-spacing:.04em; }

/* 2カラム */
.cols { display:grid; grid-template-columns:1.15fr 1fr; gap:10px; margin-top:10px; }
.col { background:#fff; padding:12px 14px; border-left:3px solid ${NAVY}; }
.col h3 { font-size:11px; font-weight:700; color:${NAVY}; letter-spacing:.04em; }
.pts { margin-top:6px; display:grid; gap:5px; }
.pt { display:grid; grid-template-columns:22px 1fr; gap:6px; align-items:baseline; }
.pt i { font-style:normal; font-size:10px; font-weight:900; color:${GOLD}; letter-spacing:.1em; }
.pt b { display:block; font-size:10px; font-weight:700; color:${NAVY}; }
.pt p { font-size:8.5px; line-height:1.5; color:#4A5A68; margin-top:1px; }
.copy { font-size:10.5px; line-height:1.85; color:${INK}; margin-top:10px; }
.col.gold { border-left-color:${GOLD}; }

/* 比較表 */
.cmp { background:#fff; margin-top:10px; padding:10px 14px 6px; }
.cmp h3 { font-size:10px; font-weight:700; color:${NAVY}; letter-spacing:.04em; }
.tbl { width:100%; border-collapse:collapse; margin-top:6px; font-size:10px; }
.tbl th { font-size:8px; font-weight:700; color:${MUTE}; letter-spacing:.06em; padding:5px 8px; text-align:right; border-bottom:1.5px solid ${NAVY}; white-space:nowrap; }
.tbl td { padding:4px 8px; text-align:right; border-bottom:1px solid ${LINE}; color:#3A4A58; }
.tbl .tl { text-align:left; }
.tbl td.tl { font-weight:400; color:${INK}; }
.tbl tr.me td.tl { font-weight:700; color:${NAVY}; }
.tbl td.em { font-weight:700; color:${NAVY}; }
.tbl tr.me td { background:#F4F1E8; }
.tbl tr:last-child td { border-bottom:0; }

/* 注記・フッター */
.notes { margin-top:8px; font-size:7.4px; line-height:1.5; color:${MUTE}; }
.ft { position:absolute; left:20mm; right:16mm; bottom:10mm; display:flex; justify-content:space-between; align-items:flex-end;
  border-top:1px solid ${LINE}; padding-top:8px; }
.ft .l b { display:block; font-size:10px; font-weight:700; color:${INK}; }
.ft .l span { display:block; font-size:8px; color:${MUTE}; margin-top:2px; letter-spacing:.04em; }
.ft .r { text-align:right; font-size:8px; color:${MUTE}; letter-spacing:.12em; line-height:1.6; }
</style></head>
<body><div class="sheet">
  <div class="bar"></div>

  <div class="top">
    <div class="issuer"><b>${esc(d.issuerName)}</b><span>TVer広告 商圏網羅プランのご案内</span></div>
    <div class="grp"><img src="${logoUrl}" alt=""><span>AD ARCH GROUP</span></div>
  </div>

  ${d.clientName ? `<div class="client">${esc(d.clientName)} 御中</div>` : ""}

  <div class="eyebrow">FOR YOUR AREA ／ 御社の商圏</div>
  <h1>${esc(d.areaLabel)}を、<br>まるごと。</h1>
  <div class="rule"></div>
  <p class="lead">${areaDesc}の商圏を、TVer広告（${secLabel}）で押さえる場合の金額です。<br>民放公式のテレビ配信サービスで、テレビ局の番組が、そのままの品質で配信されています。</p>

  <div class="kpis">
    <div class="kpi"><b>${man(d.viewers)}</b><span>${multi ? "商圏内" : "市内"}のTVer視聴者（推計）</span></div>
    <div class="kpi g"><b>${man(d.reach)}</b><span>到達する人数（3人に1人）</span></div>
    <div class="kpi g"><b>${yen(d.monthly)}</b><span>月額 媒体費（税抜）</span></div>
    <div class="kpi"><b>${yen(d.total)}</b><span>標準3ヶ月 総額（税抜）</span></div>
  </div>

  <div class="cov">
    ${ring(cov.pct)}
    <div>
      <p>${cov.isCustom ? `ご予算<b>${yenPlain(cov.budget)}</b>なら、` : `同じ<b>100万円</b>を出した場合、`}${multi ? "商圏内" : "市内"}のTVer視聴者の<b>${cov.pct.toFixed(1)}%</b><span style="white-space:nowrap">（約${num(Math.round(cov.reach))}人）</span>に届きます。</p>
      <em>大都市では同じ金額で1〜2%。「まるごと押さえる」は、地元の商圏だからできる買い方です。</em>
    </div>
  </div>

  <div class="cols">
    <div class="col">
      <h3>3ヶ月で、商圏の認知を取り切る</h3>
      <div class="pts">
        ${bullets.map(([n, t, p]) => `<div class="pt"><i>${n}</i><div><b>${t}</b><p>${p}</p></div></div>`).join("")}
      </div>
    </div>
    <div class="col gold">
      <h3>${d.industry ? `${esc(d.industry)}の皆さまへ` : "地元の企業の皆さまへ"}</h3>
      <p class="copy">${catchCopy}</p>
    </div>
  </div>

  ${d.neighbors.length > 0 ? `
  <div class="cmp">
    <h3>ご参考：${esc(d.prefName)}内で規模の近い市との比較（月額・${secLabel}）</h3>
    <table class="tbl">
      <thead><tr><th class="tl">エリア</th><th>人口</th><th>TVer視聴者（推計）</th><th>月額 媒体費</th></tr></thead>
      <tbody>
        <tr class="me"><td class="tl">${esc(d.areaLabel)}</td><td>${num(d.population)}人</td><td>${manPlain(d.viewers)}</td><td class="em">${yenPlain(d.monthly)}</td></tr>
        ${neighborRows}
      </tbody>
    </table>
  </div>` : ""}

  <div class="notes">
    ※ 視聴者数・到達人数・到達率は推計値であり、保証値ではありません。TVer視聴者数は TVer INC. 公表の月間ユーザー数（2026年1月・4,470万）を総務省「人口推計」「住民基本台帳人口」で按分した推計です。到達人数は当社配信実績のフリークエンシーをもとに算出しています。<br>
    ※ 金額は媒体費（税抜）です。CM制作費・考査費等は別途お見積りします。商圏が複数の市町村にまたがる場合は合算してお出しします。
  </div>

  <div class="ft">
    <div class="l">
      <b>${d.issuerContact ? `お問い合わせ: ${esc(d.issuerContact)}` : esc(d.issuerName)}</b>
      <span>${issuerIsGroup ? "TVer広告 商圏網羅プラン" : `${esc(d.issuerName)} ／ Ad Archグループ`}</span>
    </div>
    <div class="r">${fmtDate(d.date)}<br>TVer ADVERTISING</div>
  </div>
</div></body></html>`;
}
