// ==============================================================
// TVer配信レポート（クライアント提出用・A4縦2ページ）— Chrome headless でPDF化
//   ブランド規定 2026-09-04: 墨×白／橙は1ページ1〜2か所／太さは400・600（900は使わない）／
//   角丸・影・枠線カードを使わない／区切りは罫線1本／数字は大きく説明は小さく／注記は面の箱
//   金額は売価（税抜）だけ。卸値・裏計算・調整したことは載せない
// ==============================================================

import path from "path";
import type { Breakdown } from "@/lib/tver/delivery-csv";
import { FREQ } from "@/lib/tver/plan";

const fontDir = path.join(process.cwd(), "public/fonts");
const fontUrl = (f: string) => "file://" + path.join(fontDir, f);
const logoUrl = "file://" + path.join(process.cwd(), "public/logo-adarch.png");

const INK = "#111111", SUB = "#6A6A6A", RULE = "#E6E4E0", ALT = "#F7F6F4", FAINT = "#B8B8B4", OR = "#F19834";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number) => Math.round(n).toLocaleString("ja-JP");
const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const pct = (a: number, b: number, d = 1) => (b > 0 ? `${(Math.round((a / b) * 10 ** (d + 2)) / 10 ** d).toFixed(d)}%` : "—");
const fmtD = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(d);
const shortD = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(d);

export type ReportPdfData = {
  advertiserName: string;
  branchName: string;
  periodStart: Date;
  periodEnd: Date;
  areaLabel: string | null;
  areaPopulation: number | null;
  adSeconds: number | null;
  industry: string | null;
  sharedNote: string | null;
  partnerNote: string | null;
  impressions: number;
  completes: number;
  clicks: number;
  amount: number;
  showAmount: boolean;
  byDate: { date: Date; impressions: number; completes: number }[];
  byPref: Breakdown[];
  byDevice: Breakdown[];
  byAge: Breakdown[];
};

/** 日別の棒グラフ（墨。最大の日だけ橙＝橙の一点） */
function barChart(rows: { date: Date; impressions: number }[]): string {
  if (rows.length === 0) return "";
  const W = 660, H = 150, gap = 2;
  const max = Math.max(...rows.map((r) => r.impressions), 1);
  // 日数が少ない時に1本が巨大にならないよう、棒の幅は上限28px（左寄せ）
  const bw = Math.min(28, Math.max(2, (W - gap * (rows.length - 1)) / rows.length));
  // 橙は「一点」なので、本数が少ない時は墨だけで組む
  const peak = rows.length >= 5 ? rows.reduce((a, b) => (b.impressions > a.impressions ? b : a), rows[0]) : null;
  const bars = rows
    .map((r, i) => {
      const h = Math.max(1, (r.impressions / max) * H);
      const x = i * (bw + gap);
      return `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${r === peak ? OR : INK}"/>`;
    })
    .join("");
  const labelEvery = Math.ceil(rows.length / 10);
  const labels = rows
    .map((r, i) => (i % labelEvery === 0 || r === peak ? `<text x="${(i * (bw + gap) + bw / 2).toFixed(1)}" y="${H + 14}" text-anchor="middle" font-size="9" fill="${SUB}">${shortD(r.date)}</text>` : ""))
    .join("");
  return `<svg viewBox="0 0 ${W} ${H + 20}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
    ${bars}<line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="${RULE}" stroke-width="1"/>${labels}</svg>`;
}

function table(title: string, rows: Breakdown[], keyLabel: string, total: number, limit = 12): string {
  const shown = rows.slice(0, limit);
  return `<section class="blk">
    <h3>${esc(title)}</h3>
    <table>
      <thead><tr><th class="l">${esc(keyLabel)}</th><th>表示回数</th><th>完全視聴</th><th>完全視聴率</th><th>構成比</th></tr></thead>
      <tbody>
        ${shown
          .map(
            (b) => `<tr><td class="l">${esc(b.key)}</td><td>${num(b.impressions)}</td><td>${num(b.completes)}</td><td>${pct(b.completes, b.impressions)}</td><td>${pct(b.impressions, total)}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </section>`;
}

export function buildReportHtml(d: ReportPdfData): string {
  const reach = Math.round(d.impressions / FREQ);
  const residents = d.areaPopulation ? pct(reach, d.areaPopulation) : null;
  const period = `${fmtD(d.periodStart)} 〜 ${fmtD(d.periodEnd)}`;
  const stats: [string, string, string][] = [
    ["表示回数", num(d.impressions), "CMが再生された回数"],
    ["完全視聴", num(d.completes), `最後まで見られた割合 ${pct(d.completes, d.impressions)}`],
    ["推定到達人数", `${num(reach)}<small>人</small>`, residents ? `商圏の住民の ${residents}` : "表示回数 ÷ 平均接触回数"],
  ];
  if (d.showAmount) stats.unshift(["配信料（税抜）", yen(d.amount), "この期間の媒体費用"]);

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<style>
@font-face { font-family:"Noto Sans JP"; font-weight:400; src:url("${fontUrl("NotoSansJP-Regular.ttf")}") format("truetype"); }
@font-face { font-family:"Noto Sans JP"; font-weight:600; src:url("${fontUrl("NotoSansJP-Bold.ttf")}") format("truetype"); }
@page { size:210mm 297mm; margin:0; }
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Noto Sans JP","Noto Sans CJK JP","Hiragino Sans",sans-serif;color:${INK};background:#fff;font-weight:400;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;padding:18mm 16mm 14mm;position:relative;page-break-after:always;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
.eb{display:flex;align-items:center;gap:8px;font-size:8.5pt;letter-spacing:.18em;color:${SUB}}
.eb::before{content:"";width:22px;height:2px;background:${OR}}
h1{font-size:22pt;font-weight:600;letter-spacing:.02em;margin:6px 0 4px;line-height:1.3}
.lead{font-size:10pt;color:${SUB};line-height:1.7}
.rule{border-top:1px solid ${RULE};margin:10px 0}
.stats{display:flex;gap:0;margin:4px 0 2px}
.stat{flex:1;padding:10px 12px 10px 0}
.stat + .stat{border-left:1px solid ${RULE};padding-left:14px}
.stat .k{font-size:8.5pt;color:${SUB};letter-spacing:.04em}
.stat .v{font-size:26pt;font-weight:600;line-height:1.15;letter-spacing:-.01em;margin-top:2px}
.stat .v small{font-size:12pt;font-weight:400;margin-left:1px}
.stat .s{font-size:8.5pt;color:${SUB};margin-top:3px;line-height:1.5}
h3{font-size:10.5pt;font-weight:600;margin-bottom:6px}
.blk{margin-top:14px}
table{width:100%;border-collapse:collapse;font-size:9pt}
th{font-weight:400;color:${SUB};font-size:8.5pt;text-align:right;padding:0 0 5px}
th.l,td.l{text-align:left}
thead tr{border-bottom:1px solid ${INK}}
td{text-align:right;padding:5px 0;border-bottom:.5px solid ${RULE};font-variant-numeric:tabular-nums}
td.l{font-weight:600}
.note{background:${ALT};padding:10px 12px;margin-top:auto;font-size:8.5pt;color:${SUB};line-height:1.7}
.note b{color:${INK};font-weight:600}
.foot{position:absolute;left:16mm;right:16mm;bottom:8mm;display:flex;align-items:center;justify-content:space-between;font-size:8pt;color:${FAINT};letter-spacing:.08em}
.foot img{height:11px;opacity:.85}
.foot .r{display:flex;gap:10px}
.msg{font-size:9.5pt;line-height:1.75;margin-top:10px;white-space:pre-wrap}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
</style></head><body>

<div class="page">
  <div class="eb">TVER DELIVERY REPORT</div>
  <h1>${esc(d.advertiserName)} 様<br>TVer CM 配信レポート</h1>
  <p class="lead">${esc(period)}${d.adSeconds ? `／${d.adSeconds}秒CM` : ""}<br>配信エリア：${esc(d.areaLabel ?? "—")}${d.areaPopulation ? `（人口 ${num(d.areaPopulation)}人）` : ""}</p>
  <div class="rule"></div>

  <div class="stats">
    ${stats.map(([k, v, s]) => `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`).join("")}
  </div>

  ${d.byDate.length >= 3
    ? `<div class="blk"><h3>日ごとの配信量</h3>${barChart(d.byDate)}</div>`
    : `<div class="blk"><h3>日ごとの配信量</h3><p class="lead">このレポートは期間の合計です（日ごとの内訳はありません）。</p></div>`}

  ${d.sharedNote ? `<div class="blk"><h3>この配信について</h3><div class="msg">${esc(d.sharedNote)}</div></div>` : ""}

  <div class="note">
    <b>読み方</b>　「表示回数」はCMが再生された回数、「完全視聴」は最後まで見られた回数です。「推定到達人数」は表示回数を1人あたりの平均接触回数（${FREQ}回・自社実測）で割った推計で、実際に視聴された人数を保証するものではありません${d.areaPopulation ? "。住民比は配信エリアの総人口に対する割合です" : ""}。
  </div>
  <div class="foot"><img src="${logoUrl}" alt=""><div class="r"><span>${esc(d.branchName)}</span><span>1 / 2</span></div></div>
</div>

<div class="page">
  <div class="eb">BREAKDOWN</div>
  <h1>届いた先の内訳</h1>
  <p class="lead">どの地域の・どの機器で・どの層に届いたか。次回の配信設計にお使いください。</p>
  <div class="rule"></div>

  ${table("都道府県別", d.byPref, "都道府県", d.impressions, 10)}
  <div class="two">
    ${table("デバイス別", d.byDevice, "デバイス", d.impressions, 6)}
    ${table("性別・年齢別", d.byAge, "性別 年齢", d.impressions, 10)}
  </div>

  <div class="note">
    <b>ご参考</b>　CTV（テレビ受像機）での視聴が多いほど、家族そろってご覧いただけている目安になります。スマートフォンでの視聴は、通勤・休憩などの時間帯に届いています。次回は配信エリア・時期・秒数のいずれかを変えると、届く層が変わります。
  </div>
  <div class="foot"><img src="${logoUrl}" alt=""><div class="r"><span>${esc(d.branchName)}</span><span>2 / 2</span></div></div>
</div>
</body></html>`;
}
