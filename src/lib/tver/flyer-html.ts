// 本部チラシ制作サポート — A4縦チラシのHTML（Chrome headless でPDF化）
// テンプレートは3種（数値は同じ・見た目だけ違う。代表が好きなものを使う）:
//   orange  … 白地×オレンジ#F19834（コーポレート「ORANGE」トーン）。人のイラスト入り・柔らかい一般向け＝既定
//   classic … 紺×金。TVer資料デッキ（tver_deck.html）と同じデザイン言語
//   poster  … 濃紺全面・数字を主役にしたポスター調
// 人物・TVなどの絵は全てインラインSVG（外部画像なし）
import path from "path";
import type { FlyerData } from "@/lib/tver/flyer-data";
import type { FlyerTemplateKey } from "@/lib/constants/tver-flyer";

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

// ── アイコン（フラットSVG・単色） ─────────────────────────────
type IconKey = "people" | "calendar" | "tv" | "pin";

function icon(key: IconKey, color: string): string {
  const svgs: Record<IconKey, string> = {
    people: `<circle cx="8.2" cy="8.6" r="3.4" fill="${color}"/><path d="M2.4 19.6c0-3.3 2.6-5.6 5.8-5.6s5.8 2.3 5.8 5.6z" fill="${color}"/>
      <circle cx="16.6" cy="7.6" r="2.7" fill="${color}" opacity=".55"/><path d="M13.6 18.4c.5-2.7 2.4-4.3 4.9-4.3 1.9 0 3.4 1 4.1 2.6v1.7z" fill="${color}" opacity=".55"/>`,
    calendar: `<rect x="3" y="5" width="18" height="16" rx="2.6" fill="none" stroke="${color}" stroke-width="2"/>
      <path d="M3 9.6h18" stroke="${color}" stroke-width="2"/>
      <path d="M8 2.8v3.6M16 2.8v3.6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="8.4" cy="14.6" r="1.35" fill="${color}"/><circle cx="12.4" cy="14.6" r="1.35" fill="${color}"/><circle cx="16.4" cy="14.6" r="1.35" fill="${color}"/>`,
    tv: `<rect x="2.6" y="5.4" width="18.8" height="12.6" rx="2.4" fill="none" stroke="${color}" stroke-width="2"/>
      <path d="M8.6 21.4h6.8" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M10.4 9.2l4.6 2.5-4.6 2.5z" fill="${color}"/>`,
    pin: `<path d="M12 2.6c-3.9 0-6.8 2.9-6.8 6.6 0 4.8 6.8 12 6.8 12s6.8-7.2 6.8-12c0-3.7-2.9-6.6-6.8-6.6z" fill="none" stroke="${color}" stroke-width="2"/>
      <circle cx="12" cy="9" r="2.5" fill="${color}"/>`,
  };
  return `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">${svgs[key]}</svg>`;
}

/** 家族がテレビを見ているイラスト（フラットSVG） */
function familyTv(main: string, sub: string): string {
  return `
<svg viewBox="0 0 210 120" width="168" height="96" aria-hidden="true">
  <!-- TV -->
  <rect x="8" y="18" width="66" height="46" rx="5" fill="none" stroke="${main}" stroke-width="4"/>
  <rect x="16" y="26" width="50" height="30" rx="2" fill="${main}" opacity=".28"/>
  <path d="M34 34l14 7.5L34 49z" fill="${main}"/>
  <path d="M31 64h20" stroke="${main}" stroke-width="4" stroke-linecap="round"/>
  <path d="M80 30c6-3 6-9 2-13M86 36c9-5 10-16 3-23" stroke="${sub}" stroke-width="3" stroke-linecap="round" fill="none"/>
  <!-- ソファ -->
  <rect x="112" y="62" width="90" height="26" rx="9" fill="${main}" opacity=".3"/>
  <rect x="106" y="46" width="10" height="42" rx="5" fill="${main}" opacity=".45"/>
  <rect x="198" y="46" width="10" height="42" rx="5" fill="${main}" opacity=".45"/>
  <!-- 親1 -->
  <circle cx="132" cy="34" r="9" fill="${main}"/>
  <path d="M120 66c0-9 5.4-15 12-15s12 6 12 15z" fill="${main}"/>
  <!-- 親2 -->
  <circle cx="182" cy="34" r="9" fill="${main}"/>
  <path d="M170 66c0-9 5.4-15 12-15s12 6 12 15z" fill="${main}"/>
  <!-- 子ども -->
  <circle cx="157" cy="46" r="7" fill="${sub}"/>
  <path d="M147.5 68c0-7 4.2-11.5 9.5-11.5s9.5 4.5 9.5 11.5z" fill="${sub}"/>
  <!-- 床 -->
  <path d="M100 92h108" stroke="${main}" stroke-width="3" stroke-linecap="round" opacity=".5"/>
</svg>`;
}

// ── 共通パーツ ─────────────────────────────────────────────
interface Parts {
  multi: boolean;
  secLabel: string;
  areaDesc: string;
  catchCopy: string; // <br>区切りのHTML
  catchTitle: string;
  bullets: [IconKey, string, string][];
  covSentence: string; // <b>強調</b>入りHTML
  covNote: string;
  issuerSub: string;
  neighborRows: string;
  meRow: string;
  notes: string;
}

function buildParts(d: FlyerData): Parts {
  const multi = d.municipalityNames.length > 1;
  const cov = d.coverage;
  const secLabel = `${d.seconds}秒CM`;
  const areaDesc = multi
    ? `${esc(d.prefName)} ${esc(d.municipalityNames.join("・"))}（合計人口 ${num(d.population)}人）`
    : `${esc(d.prefName)}${esc(d.areaLabel)}（人口 ${num(d.population)}人）`;
  const catchCopy = (d.catchCopy ?? "テレビ番組を見ているその時間に、\n地元の会社として名前を届けます。\nまず商圏を決めるところから、ご一緒します。")
    .split(/\n+/).map((l) => esc(l.trim())).filter(Boolean).join("<br>");
  const scope = multi ? "商圏内" : "市内";
  return {
    multi,
    secLabel,
    areaDesc,
    catchCopy,
    catchTitle: d.industry ? `${esc(d.industry)}の皆さまへ` : "地元の企業の皆さまへ",
    bullets: [
      ["people", "3人に1人へ、月平均約5回", `${scope}のTVer視聴者の3人に1人に、ひと月に平均約5回お届けします。`],
      ["calendar", "標準3ヶ月で、認知を取り切る", "単月で判断せず、3ヶ月続けて商圏での認知を取り切ってから効果を見ます。"],
      ["tv", "テレビ画面にも届く", "スマホ・PCに加え、テレビ画面（コネクテッドTV）で番組と同じ品質で流れます。"],
      ["pin", "最寄りの担当が対面で伴走", "企画から配信・報告まで、地元の担当が直接お伺いして進めます。"],
    ],
    covSentence:
      `${cov.isCustom ? `ご予算<b>${yenPlain(cov.budget)}</b>なら、` : `同じ<b>100万円</b>を出した場合、`}` +
      `${scope}のTVer視聴者の<b>${cov.pct.toFixed(1)}%</b><span style="white-space:nowrap">（約${num(Math.round(cov.reach))}人）</span>に届きます。`,
    covNote: "大都市では同じ金額で1〜2%。「まるごと押さえる」は、地元の商圏だからできる買い方です。",
    issuerSub: d.issuerName === "Ad Archグループ" ? "TVer広告 商圏網羅プラン" : `${esc(d.issuerName)} ／ Ad Archグループ`,
    neighborRows: d.neighbors.map((n) =>
      `<tr><td class="tl">${esc(n.areaLabel)}</td><td>${num(n.population)}人</td><td>${manPlain(n.viewers)}</td><td class="em">${yenPlain(n.monthly)}</td></tr>`).join(""),
    meRow:
      `<tr class="me"><td class="tl">${esc(d.areaLabel)}</td><td>${num(d.population)}人</td><td>${manPlain(d.viewers)}</td><td class="em">${yenPlain(d.monthly)}</td></tr>`,
    notes:
      `※ 視聴者数・到達人数・到達率は推計値であり、保証値ではありません。TVer視聴者数は TVer INC. 公表の月間ユーザー数（2026年1月・4,470万）を総務省「人口推計」「住民基本台帳人口」で按分した推計です。到達人数は当社配信実績のフリークエンシーをもとに算出しています。<br>` +
      `※ 金額は媒体費（税抜）です。CM制作費・考査費等は別途お見積りします。商圏が複数の市町村にまたがる場合は合算してお出しします。`,
  };
}

/** 到達率のリング（SVG）。色はテンプレートごとに指定 */
function ring(pct: number, o: { stroke: string; track: string; text: string; sub: string; size?: number }): string {
  const r = 54;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const dash = (c * p) / 100;
  const size = o.size ?? 118;
  return `
<svg class="ring" viewBox="0 0 140 140" width="${size}" height="${size}" aria-hidden="true">
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="${o.track}" stroke-width="14"/>
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="${o.stroke}" stroke-width="14"
    stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" transform="rotate(-90 70 70)"/>
  <text x="70" y="66" text-anchor="middle" fill="${o.text}" font-size="27" font-weight="700" font-family="Noto Sans JP">${p.toFixed(1)}<tspan font-size="14">%</tspan></text>
  <text x="70" y="88" text-anchor="middle" fill="${o.sub}" font-size="10" letter-spacing="1">到達率</text>
</svg>`;
}

const FONT_FACE = `
@font-face { font-family:"Noto Sans JP"; font-weight:400; src:url("${fontUrl("NotoSansJP-Regular.ttf")}") format("truetype"); }
@font-face { font-family:"Noto Sans JP"; font-weight:700; src:url("${fontUrl("NotoSansJP-Bold.ttf")}") format("truetype"); }
@font-face { font-family:"Noto Sans JP"; font-weight:900; src:url("${fontUrl("NotoSansJP-Bold.ttf")}") format("truetype"); }
@page { size:210mm 297mm; margin:0; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:210mm; height:297mm; }
small { font-size:.55em; font-weight:700; margin:0 .08em; }
.pt svg, .col h3 svg { vertical-align:-2px; }`;

const shell = (title: string, css: string, body: string) => `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<title>${title}</title>
<style>${FONT_FACE}
${css}</style></head>
<body>${body}</body></html>`;

/** 箇条書き（アイコンチップ付き）共通マークアップ */
const ptsHtml = (bullets: Parts["bullets"], iconColor: string) =>
  bullets.map(([k, t, x]) =>
    `<div class="pt"><i>${icon(k, iconColor)}</i><div><b>${t}</b><p>${x}</p></div></div>`).join("");

export function buildFlyerHtml(d: FlyerData, template: FlyerTemplateKey = "orange"): string {
  if (template === "classic") return classicHtml(d);
  if (template === "poster") return posterHtml(d);
  return orangeHtml(d);
}

// ══════════════════════════════════════════════════════════
// orange — 白地×オレンジ・柔らかい一般向け（既定）
// ══════════════════════════════════════════════════════════
function orangeHtml(d: FlyerData): string {
  const OR = "#F19834", OR_D = "#D97F1C", INK = "#3B372F", MUTE = "#9B948A", LINE = "#F0E7DA", SOFT = "#FFF7EC";
  const p = buildParts(d);
  const css = `
body { background:#fff; color:${INK}; font-family:"Noto Sans JP","Noto Sans CJK JP","Hiragino Sans",sans-serif;
  -webkit-font-smoothing:antialiased; font-size:10.5px; line-height:1.6; word-break:auto-phrase; overflow-wrap:anywhere; }
.sheet { position:relative; width:210mm; height:297mm; overflow:hidden; padding:14mm 16mm; background:#fff; }
.sheet::before { content:""; position:absolute; left:0; right:0; top:0; height:2.6mm; background:linear-gradient(90deg, ${OR}, #F7B25E); }
.top { display:flex; justify-content:space-between; align-items:flex-start; margin-top:2mm; }
.issuer b { display:block; font-size:14px; font-weight:700; color:${INK}; letter-spacing:.02em; }
.issuer span { display:block; font-size:8.5px; color:${MUTE}; letter-spacing:.14em; margin-top:2px; }
.grp { text-align:right; }
.grp img { height:16px; display:block; margin-left:auto; }
.grp span { display:block; font-size:8px; letter-spacing:.24em; color:${OR}; font-weight:700; margin-top:5px; }
.client { font-size:13px; font-weight:700; color:${INK}; margin-top:14px; }
.head { text-align:center; margin-top:11px; }
.eyebrow { font-size:9px; font-weight:700; letter-spacing:.3em; color:${OR}; }
h1 { font-size:38px; font-weight:900; line-height:1.22; letter-spacing:-.01em; color:${INK}; margin-top:5px; }
h1 em { font-style:normal; color:${OR}; }
.rule { width:52px; height:3px; background:${OR}; margin:9px auto 0; border-radius:2px; }
.lead { font-size:10.5px; line-height:1.7; color:#6B655C; margin:9px auto 0; max-width:155mm; text-align:center; }
.kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-top:12px; }
.kpi { background:#fff; border:1px solid ${LINE}; border-radius:12px; padding:11px 10px 10px; text-align:center;
  box-shadow:0 2px 8px rgba(217,127,28,.08); }
.kpi b { display:block; font-size:21px; font-weight:900; color:${OR_D}; letter-spacing:-.02em; line-height:1.1; white-space:nowrap; }
.kpi span { display:block; font-size:8.2px; color:${MUTE}; margin-top:6px; }
.cov { display:flex; align-items:center; gap:14px; background:linear-gradient(135deg, ${OR} 0%, #F7B25E 100%);
  color:#fff; margin-top:10px; padding:10px 18px; border-radius:16px; }
.cov .ring { flex:none; }
.cov .fam { flex:none; margin-left:auto; }
.cov p { font-size:13.5px; line-height:1.6; font-weight:700; }
.cov p b { color:#fff; text-decoration:underline; text-underline-offset:3px; text-decoration-thickness:2px; }
.cov em { display:block; font-style:normal; font-size:8.8px; color:rgba(255,255,255,.92); margin-top:5px; font-weight:400; }
.cols { display:grid; grid-template-columns:1.15fr 1fr; gap:10px; margin-top:10px; }
.col { background:#fff; border:1px solid ${LINE}; border-radius:12px; padding:12px 14px; }
.col.soft { background:${SOFT}; border-color:#F5DFC0; }
.col h3 { font-size:11px; font-weight:700; color:${INK}; }
.col h3::before { content:""; display:inline-block; width:8px; height:8px; border-radius:50%; background:${OR}; margin-right:6px; }
.pts { margin-top:7px; display:grid; gap:6px; }
.pt { display:grid; grid-template-columns:24px 1fr; gap:7px; align-items:start; }
.pt i { font-style:normal; display:flex; align-items:center; justify-content:center; width:24px; height:24px;
  background:${SOFT}; border-radius:50%; }
.pt b { display:block; font-size:9.8px; font-weight:700; color:${INK}; }
.pt p { font-size:8.4px; line-height:1.5; color:#6B655C; margin-top:1px; }
.copy { font-size:10.5px; line-height:1.9; color:${INK}; margin-top:8px; }
.cmp { margin-top:10px; background:#fff; border:1px solid ${LINE}; border-radius:12px; padding:10px 14px 6px; }
.cmp h3 { font-size:10px; font-weight:700; color:${INK}; }
.tbl { width:100%; border-collapse:collapse; margin-top:5px; font-size:9.8px; }
.tbl th { font-size:8px; font-weight:700; color:${MUTE}; letter-spacing:.06em; padding:4px 8px; text-align:right; border-bottom:1.5px solid ${OR}; white-space:nowrap; }
.tbl td { padding:4px 8px; text-align:right; border-bottom:1px solid ${LINE}; color:#575249; }
.tbl .tl { text-align:left; }
.tbl tr.me td { background:${SOFT}; }
.tbl tr.me td.tl, .tbl tr.me td.em { font-weight:700; color:${OR_D}; }
.tbl td.em { font-weight:700; color:${INK}; }
.tbl tr:last-child td { border-bottom:0; }
.notes { margin-top:8px; font-size:7.3px; line-height:1.5; color:${MUTE}; }
.ft { position:absolute; left:16mm; right:16mm; bottom:10mm; display:flex; justify-content:space-between; align-items:flex-end;
  border-top:1px solid ${LINE}; padding-top:8px; }
.ft .l b { display:block; font-size:10.5px; font-weight:700; color:${INK}; }
.ft .l span { display:block; font-size:8px; color:${MUTE}; margin-top:2px; letter-spacing:.04em; }
.ft .r { text-align:right; font-size:8px; color:${MUTE}; letter-spacing:.12em; line-height:1.6; }`;

  const body = `<div class="sheet">
  <div class="top">
    <div class="issuer"><b>${esc(d.issuerName)}</b><span>TVer広告 商圏網羅プランのご案内</span></div>
    <div class="grp"><img src="${logoUrl}" alt=""><span>AD ARCH GROUP</span></div>
  </div>
  ${d.clientName ? `<div class="client">${esc(d.clientName)} 御中</div>` : ""}
  <div class="head">
    <div class="eyebrow">FOR YOUR AREA ／ 御社の商圏</div>
    <h1>${esc(d.areaLabel)}を、<em>まるごと。</em></h1>
    <div class="rule"></div>
    <p class="lead">${p.areaDesc}の商圏を、TVer広告（${p.secLabel}）で押さえる場合の金額です。<br>民放公式のテレビ配信サービスで、テレビ局の番組が、そのままの品質で配信されています。</p>
  </div>
  <div class="kpis">
    <div class="kpi"><b>${man(d.viewers)}</b><span>TVer視聴者（推計）</span></div>
    <div class="kpi"><b>${man(d.reach)}</b><span>到達する人数（3人に1人）</span></div>
    <div class="kpi"><b>${yen(d.monthly)}</b><span>月額 媒体費（税抜）</span></div>
    <div class="kpi"><b>${yen(d.total)}</b><span>標準3ヶ月 総額（税抜）</span></div>
  </div>
  <div class="cov">
    ${ring(d.coverage.pct, { stroke: "#fff", track: "rgba(255,255,255,.35)", text: "#fff", sub: "rgba(255,255,255,.9)", size: 106 })}
    <div><p>${p.covSentence}</p><em>${p.covNote}</em></div>
    <div class="fam">${familyTv("#ffffff", "rgba(255,255,255,.75)")}</div>
  </div>
  <div class="cols">
    <div class="col">
      <h3>3ヶ月で、商圏の認知を取り切る</h3>
      <div class="pts">${ptsHtml(p.bullets, OR_D)}</div>
    </div>
    <div class="col soft"><h3>${p.catchTitle}</h3><p class="copy">${p.catchCopy}</p></div>
  </div>
  ${d.neighbors.length > 0 ? `
  <div class="cmp">
    <h3>ご参考：${esc(d.prefName)}内で規模の近い市との比較（月額・${p.secLabel}）</h3>
    <table class="tbl">
      <thead><tr><th class="tl">エリア</th><th>人口</th><th>TVer視聴者（推計）</th><th>月額 媒体費</th></tr></thead>
      <tbody>${p.meRow}${p.neighborRows}</tbody>
    </table>
  </div>` : ""}
  <div class="notes">${p.notes}</div>
  <div class="ft">
    <div class="l">
      <b>${d.issuerContact ? `お問い合わせ: ${esc(d.issuerContact)}` : esc(d.issuerName)}</b>
      <span>${p.issuerSub}</span>
    </div>
    <div class="r">${fmtDate(d.date)}<br>TVer ADVERTISING</div>
  </div>
</div>`;
  return shell(`${esc(d.areaLabel)}を、まるごと。`, css, body);
}

// ══════════════════════════════════════════════════════════
// classic — 紺×金（資料デッキと同じデザイン言語）
// ══════════════════════════════════════════════════════════
function classicHtml(d: FlyerData): string {
  const NAVY = "#1B3A5C", GOLD = "#C9A961", PAPER = "#FBFAF5", INK = "#243746", MUTE = "#8A94A0", LINE = "#E3DECF";
  const p = buildParts(d);
  const css = `
body { background:${PAPER}; color:${INK}; font-family:"Noto Sans JP","Noto Sans CJK JP","Hiragino Sans",sans-serif;
  -webkit-font-smoothing:antialiased; font-size:10.5px; line-height:1.6; word-break:auto-phrase; overflow-wrap:anywhere; }
.sheet { position:relative; width:210mm; height:297mm; overflow:hidden; padding:15mm 16mm 14mm 20mm; }
.bar { position:absolute; left:0; top:0; width:5mm; height:100%; background:${NAVY}; }
.bar::after { content:""; position:absolute; left:0; top:0; width:5mm; height:38%; background:${GOLD}; }
.top { display:flex; justify-content:space-between; align-items:flex-start; }
.issuer b { display:block; font-size:14px; font-weight:700; color:${NAVY}; letter-spacing:.02em; }
.issuer span { display:block; font-size:8.5px; color:${MUTE}; letter-spacing:.14em; margin-top:2px; }
.grp { text-align:right; }
.grp img { height:16px; display:block; margin-left:auto; }
.grp span { display:block; font-size:8px; letter-spacing:.24em; color:${GOLD}; font-weight:700; margin-top:5px; }
.client { font-size:13px; font-weight:700; color:${INK}; margin-top:18px; }
.eyebrow { font-size:9px; font-weight:700; letter-spacing:.26em; color:${GOLD}; margin-top:16px; }
h1 { font-size:40px; font-weight:900; line-height:1.18; letter-spacing:-.01em; color:${NAVY}; margin-top:6px; }
.rule { width:44px; height:3px; background:${GOLD}; margin-top:10px; }
.lead { font-size:10.5px; line-height:1.7; color:#4A5A68; margin-top:10px; max-width:150mm; }
.kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:13px; }
.kpi { background:#fff; border-top:3px solid ${LINE}; padding:12px 12px 10px; box-shadow:0 1px 3px rgba(27,58,92,.07); }
.kpi.g { border-top-color:${GOLD}; }
.kpi b { display:block; font-size:22px; font-weight:900; color:${NAVY}; letter-spacing:-.02em; line-height:1.1; white-space:nowrap; }
.kpi span { display:block; font-size:8.3px; color:${MUTE}; margin-top:6px; letter-spacing:.02em; }
.cov { display:flex; align-items:center; gap:16px; background:${NAVY}; color:#fff; margin-top:10px; padding:10px 20px; }
.cov .ring { flex:none; }
.cov .fam { flex:none; margin-left:auto; }
.cov p { font-size:13.5px; line-height:1.6; font-weight:400; }
.cov p b { color:#E6C97A; font-weight:700; }
.cov em { display:block; font-style:normal; font-size:8.8px; color:#B9C7D6; margin-top:5px; letter-spacing:.04em; }
.cols { display:grid; grid-template-columns:1.15fr 1fr; gap:10px; margin-top:10px; }
.col { background:#fff; padding:12px 14px; border-left:3px solid ${NAVY}; }
.col h3 { font-size:11px; font-weight:700; color:${NAVY}; letter-spacing:.04em; }
.pts { margin-top:6px; display:grid; gap:6px; }
.pt { display:grid; grid-template-columns:24px 1fr; gap:7px; align-items:start; }
.pt i { font-style:normal; display:flex; align-items:center; justify-content:center; width:24px; height:24px;
  background:#F4F1E8; border-radius:50%; }
.pt b { display:block; font-size:10px; font-weight:700; color:${NAVY}; }
.pt p { font-size:8.5px; line-height:1.5; color:#4A5A68; margin-top:1px; }
.copy { font-size:10.5px; line-height:1.85; color:${INK}; margin-top:10px; }
.col.gold { border-left-color:${GOLD}; }
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
.notes { margin-top:8px; font-size:7.4px; line-height:1.5; color:${MUTE}; }
.ft { position:absolute; left:20mm; right:16mm; bottom:10mm; display:flex; justify-content:space-between; align-items:flex-end;
  border-top:1px solid ${LINE}; padding-top:8px; }
.ft .l b { display:block; font-size:10px; font-weight:700; color:${INK}; }
.ft .l span { display:block; font-size:8px; color:${MUTE}; margin-top:2px; letter-spacing:.04em; }
.ft .r { text-align:right; font-size:8px; color:${MUTE}; letter-spacing:.12em; line-height:1.6; }`;

  const body = `<div class="sheet">
  <div class="bar"></div>
  <div class="top">
    <div class="issuer"><b>${esc(d.issuerName)}</b><span>TVer広告 商圏網羅プランのご案内</span></div>
    <div class="grp"><img src="${logoUrl}" alt=""><span>AD ARCH GROUP</span></div>
  </div>
  ${d.clientName ? `<div class="client">${esc(d.clientName)} 御中</div>` : ""}
  <div class="eyebrow">FOR YOUR AREA ／ 御社の商圏</div>
  <h1>${esc(d.areaLabel)}を、<br>まるごと。</h1>
  <div class="rule"></div>
  <p class="lead">${p.areaDesc}の商圏を、TVer広告（${p.secLabel}）で押さえる場合の金額です。<br>民放公式のテレビ配信サービスで、テレビ局の番組が、そのままの品質で配信されています。</p>
  <div class="kpis">
    <div class="kpi"><b>${man(d.viewers)}</b><span>TVer視聴者（推計）</span></div>
    <div class="kpi g"><b>${man(d.reach)}</b><span>到達する人数（3人に1人）</span></div>
    <div class="kpi g"><b>${yen(d.monthly)}</b><span>月額 媒体費（税抜）</span></div>
    <div class="kpi"><b>${yen(d.total)}</b><span>標準3ヶ月 総額（税抜）</span></div>
  </div>
  <div class="cov">
    ${ring(d.coverage.pct, { stroke: GOLD, track: "rgba(255,255,255,.14)", text: "#fff", sub: "#B9C7D6", size: 106 })}
    <div><p>${p.covSentence}</p><em>${p.covNote}</em></div>
    <div class="fam">${familyTv("#ffffff", "#E6C97A")}</div>
  </div>
  <div class="cols">
    <div class="col">
      <h3>3ヶ月で、商圏の認知を取り切る</h3>
      <div class="pts">${ptsHtml(p.bullets, NAVY)}</div>
    </div>
    <div class="col gold"><h3>${p.catchTitle}</h3><p class="copy">${p.catchCopy}</p></div>
  </div>
  ${d.neighbors.length > 0 ? `
  <div class="cmp">
    <h3>ご参考：${esc(d.prefName)}内で規模の近い市との比較（月額・${p.secLabel}）</h3>
    <table class="tbl">
      <thead><tr><th class="tl">エリア</th><th>人口</th><th>TVer視聴者（推計）</th><th>月額 媒体費</th></tr></thead>
      <tbody>${p.meRow}${p.neighborRows}</tbody>
    </table>
  </div>` : ""}
  <div class="notes">${p.notes}</div>
  <div class="ft">
    <div class="l">
      <b>${d.issuerContact ? `お問い合わせ: ${esc(d.issuerContact)}` : esc(d.issuerName)}</b>
      <span>${p.issuerSub}</span>
    </div>
    <div class="r">${fmtDate(d.date)}<br>TVer ADVERTISING</div>
  </div>
</div>`;
  return shell(`${esc(d.areaLabel)}を、まるごと。`, css, body);
}

// ══════════════════════════════════════════════════════════
// poster — 濃紺全面・数字が主役
// ══════════════════════════════════════════════════════════
function posterHtml(d: FlyerData): string {
  const BG = "#12283F", GOLD = "#E6C97A", GOLD_D = "#C9A961", SUB = "#9FB3C8", LINE = "rgba(255,255,255,.16)";
  const p = buildParts(d);
  const css = `
body { background:${BG}; color:#fff; font-family:"Noto Sans JP","Noto Sans CJK JP","Hiragino Sans",sans-serif;
  -webkit-font-smoothing:antialiased; font-size:10.5px; line-height:1.6; word-break:auto-phrase; overflow-wrap:anywhere; }
.sheet { position:relative; width:210mm; height:297mm; overflow:hidden; padding:15mm 18mm 14mm; background:${BG}; }
.sheet::before { content:""; position:absolute; left:0; right:0; top:0; height:2.2mm; background:${GOLD_D}; }
.top { display:flex; justify-content:space-between; align-items:flex-start; }
.issuer b { display:block; font-size:14px; font-weight:700; color:#fff; letter-spacing:.02em; }
.issuer span { display:block; font-size:8.5px; color:${SUB}; letter-spacing:.14em; margin-top:2px; }
.grp { text-align:right; }
.grp img { height:16px; display:block; margin-left:auto; filter:brightness(0) invert(1); opacity:.92; }
.grp span { display:block; font-size:8px; letter-spacing:.24em; color:${GOLD_D}; font-weight:700; margin-top:5px; }
.client { font-size:13px; font-weight:700; color:#fff; margin-top:16px; }
.eyebrow { font-size:9px; font-weight:700; letter-spacing:.3em; color:${GOLD_D}; margin-top:16px; }
h1 { font-size:46px; font-weight:900; line-height:1.16; letter-spacing:-.01em; color:#fff; margin-top:6px; }
h1 em { font-style:normal; color:${GOLD}; }
.lead { font-size:10.5px; line-height:1.7; color:${SUB}; margin-top:10px; max-width:150mm; }
.hero { display:flex; align-items:center; gap:24px; margin-top:13px; padding:13px 0 14px; border-top:1px solid ${LINE}; border-bottom:1px solid ${LINE}; }
.price { flex:1; }
.price i { font-style:normal; display:block; font-size:9px; letter-spacing:.22em; color:${GOLD_D}; font-weight:700; }
.price b { display:block; font-size:50px; font-weight:900; letter-spacing:-.02em; line-height:1.08; margin-top:4px; white-space:nowrap; }
.price em { font-style:normal; display:block; font-size:9.5px; color:${SUB}; margin-top:6px; }
.price em b2 { color:#fff; font-weight:700; }
.hero .ring { flex:none; }
.hero .fam { flex:none; }
.kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:11px; }
.kpi { border-top:2px solid ${GOLD_D}; padding-top:8px; }
.kpi b { display:block; font-size:20px; font-weight:900; color:#fff; letter-spacing:-.02em; white-space:nowrap; }
.kpi span { display:block; font-size:8.3px; color:${SUB}; margin-top:4px; }
.covline { margin-top:11px; font-size:13px; line-height:1.65; }
.covline b { color:${GOLD}; font-weight:700; }
.covline em { display:block; font-style:normal; font-size:8.8px; color:${SUB}; margin-top:4px; }
.cols { display:grid; grid-template-columns:1.15fr 1fr; gap:12px; margin-top:11px; }
.col h3 { font-size:10.5px; font-weight:700; color:#fff; letter-spacing:.06em; padding-bottom:5px; border-bottom:1px solid ${LINE}; }
.pts { margin-top:7px; display:grid; gap:6px; }
.pt { display:grid; grid-template-columns:24px 1fr; gap:7px; align-items:start; }
.pt i { font-style:normal; display:flex; align-items:center; justify-content:center; width:24px; height:24px;
  background:rgba(201,169,97,.16); border-radius:50%; }
.pt b { display:block; font-size:9.8px; font-weight:700; color:#fff; }
.pt p { font-size:8.4px; line-height:1.5; color:${SUB}; margin-top:1px; }
.copy { font-size:10.5px; line-height:1.9; color:#EAF0F6; margin-top:8px; }
.cmp { margin-top:11px; background:rgba(255,255,255,.04); border:1px solid ${LINE}; padding:10px 14px 6px; }
.cmp h3 { font-size:9.5px; font-weight:700; color:#fff; letter-spacing:.04em; }
.tbl { width:100%; border-collapse:collapse; margin-top:5px; font-size:9.8px; }
.tbl th { font-size:8px; font-weight:700; color:${SUB}; letter-spacing:.06em; padding:4px 8px; text-align:right; border-bottom:1px solid ${GOLD_D}; white-space:nowrap; }
.tbl td { padding:4px 8px; text-align:right; border-bottom:1px solid ${LINE}; color:#D7E1EA; }
.tbl .tl { text-align:left; }
.tbl tr.me td { background:rgba(201,169,97,.14); }
.tbl tr.me td.tl, .tbl tr.me td.em { color:${GOLD}; font-weight:700; }
.tbl td.em { font-weight:700; color:#fff; }
.tbl tr:last-child td { border-bottom:0; }
.notes { margin-top:9px; font-size:7.3px; line-height:1.5; color:#7E93A8; }
.ft { position:absolute; left:18mm; right:18mm; bottom:10mm; display:flex; justify-content:space-between; align-items:flex-end;
  border-top:1px solid ${LINE}; padding-top:8px; }
.ft .l b { display:block; font-size:10px; font-weight:700; color:#fff; }
.ft .l span { display:block; font-size:8px; color:${SUB}; margin-top:2px; letter-spacing:.04em; }
.ft .r { text-align:right; font-size:8px; color:${SUB}; letter-spacing:.12em; line-height:1.6; }`;

  const body = `<div class="sheet">
  <div class="top">
    <div class="issuer"><b>${esc(d.issuerName)}</b><span>TVer広告 商圏網羅プランのご案内</span></div>
    <div class="grp"><img src="${logoUrl}" alt=""><span>AD ARCH GROUP</span></div>
  </div>
  ${d.clientName ? `<div class="client">${esc(d.clientName)} 御中</div>` : ""}
  <div class="eyebrow">FOR YOUR AREA ／ 御社の商圏</div>
  <h1>${esc(d.areaLabel)}を、<em>まるごと。</em></h1>
  <p class="lead">${p.areaDesc}の商圏を、TVer広告（${p.secLabel}）で押さえる場合の金額です。民放公式のテレビ配信サービスで、テレビ局の番組が、そのままの品質で配信されています。</p>
  <div class="hero">
    <div class="price">
      <i>MONTHLY ／ 月額 媒体費（税抜）</i>
      <b>${yen(d.monthly)}</b>
      <em>標準3ヶ月 総額 <b2>${yenPlain(d.total)}</b2>（税抜）・${p.secLabel}</em>
    </div>
    <div class="fam">${familyTv("rgba(255,255,255,.9)", GOLD_D)}</div>
    ${ring(d.coverage.pct, { stroke: GOLD_D, track: "rgba(255,255,255,.12)", text: "#fff", sub: SUB, size: 120 })}
  </div>
  <div class="kpis">
    <div class="kpi"><b>${man(d.viewers)}</b><span>TVer視聴者（推計）</span></div>
    <div class="kpi"><b>${man(d.reach)}</b><span>到達する人数（3人に1人）</span></div>
    <div class="kpi"><b>月5回<small>×3ヶ月</small></b><span>ひと月平均の接触回数 × 標準期間</span></div>
  </div>
  <p class="covline">${p.covSentence}<em>${p.covNote}</em></p>
  <div class="cols">
    <div class="col">
      <h3>3ヶ月で、商圏の認知を取り切る</h3>
      <div class="pts">${ptsHtml(p.bullets, GOLD)}</div>
    </div>
    <div class="col"><h3>${p.catchTitle}</h3><p class="copy">${p.catchCopy}</p></div>
  </div>
  ${d.neighbors.length > 0 ? `
  <div class="cmp">
    <h3>ご参考：${esc(d.prefName)}内で規模の近い市との比較（月額・${p.secLabel}）</h3>
    <table class="tbl">
      <thead><tr><th class="tl">エリア</th><th>人口</th><th>TVer視聴者（推計）</th><th>月額 媒体費</th></tr></thead>
      <tbody>${p.meRow}${p.neighborRows}</tbody>
    </table>
  </div>` : ""}
  <div class="notes">${p.notes}</div>
  <div class="ft">
    <div class="l">
      <b>${d.issuerContact ? `お問い合わせ: ${esc(d.issuerContact)}` : esc(d.issuerName)}</b>
      <span>${p.issuerSub}</span>
    </div>
    <div class="r">${fmtDate(d.date)}<br>TVer ADVERTISING</div>
  </div>
</div>`;
  return shell(`${esc(d.areaLabel)}を、まるごと。`, css, body);
}
