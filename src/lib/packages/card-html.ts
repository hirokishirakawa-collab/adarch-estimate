// ==============================================================
// パッケージカード（A4 1枚・クライアントに渡す統一資料）の HTML
//   本部の規定・分担・営業文・原価は載せない。載せるのは「相手が読む」ものだけ:
//   名前／一言／こんな方に／届くもの／納期／価格／オプション／流れ
// ==============================================================

import type { SalesPackage } from "@/generated/prisma/client";
import { formatPackagePrice, parseDeliverables, parseOptions, parseFulfillment, yen, CLIENT_OWNER_LABEL } from "./types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nl = (s: string) => esc(s).replace(/\n/g, "<br>");

export function buildPackageCardHtml(
  p: SalesPackage,
  seller: { company: string; name?: string | null; email?: string | null; phone?: string | null },
  /** サムネイル（data: URL）。無ければ画像なしのレイアウト */
  imageDataUrl?: string | null,
): string {
  const deliverables = parseDeliverables(p.deliverables);
  const options = parseOptions(p.options);
  const flow = parseFulfillment(p.fulfillment);
  const price = formatPackagePrice(p);

  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { width: 210mm; height: 297mm; font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif; color: #1a1a1a; background: #fff; }
  .page { width: 210mm; height: 297mm; padding: ${imageDataUrl ? "10mm" : "16mm"} 16mm 14mm; display: flex; flex-direction: column; }
  .hero { width: 100%; height: 52mm; object-fit: cover; border-radius: 3mm; margin-bottom: 5mm; display: block; }
  .head { border-bottom: 3px solid #F19834; padding-bottom: ${imageDataUrl ? "4mm" : "6mm"}; margin-bottom: ${imageDataUrl ? "5mm" : "7mm"}; }
  .cat { display: inline-block; font-size: 9pt; letter-spacing: .18em; color: #F19834; font-weight: 700; margin-bottom: 2mm; }
  h1 { font-size: 24pt; margin: 0 0 2mm; line-height: 1.25; letter-spacing: .02em; }
  .tag { font-size: 12pt; color: #444; margin: 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm 8mm; flex: 1; }
  .sec h2 { font-size: 10pt; letter-spacing: .14em; color: #666; margin: 0 0 2.5mm; padding-bottom: 1.5mm; border-bottom: 1px solid #ddd; }
  .sec p, .sec li { font-size: 10.5pt; line-height: 1.6; margin: 0; }
  ul { margin: 0; padding-left: 4mm; }
  li { margin-bottom: 1mm; }
  .dl { list-style: none; padding: 0; }
  .dl li { display: flex; justify-content: space-between; gap: 3mm; border-bottom: 1px dotted #ddd; padding: 1.2mm 0; }
  .dl .n { font-weight: 700; }
  .dl .q { color: #666; white-space: nowrap; }
  .dl .s { display: block; font-size: 9pt; color: #666; }
  .price { grid-column: 1 / -1; background: #FFF6EA; border: 1.5px solid #F19834; border-radius: 3mm; padding: 5mm 7mm; display: flex; align-items: baseline; gap: 6mm; }
  .price .l { font-size: 10pt; letter-spacing: .14em; color: #B8651A; font-weight: 700; }
  .price .v { font-size: 22pt; font-weight: 800; color: #1a1a1a; }
  .price .note { font-size: 9pt; color: #666; margin-left: auto; text-align: right; }
  .flow ol { margin: 0; padding-left: 5mm; }
  .flow li { font-size: 10pt; line-height: 1.55; }
  .flow .who { display: inline-block; font-size: 8pt; color: #fff; background: #1F3A5F; border-radius: 2mm; padding: 0 1.8mm; margin-left: 1.5mm; vertical-align: middle; }
  .foot { margin-top: 6mm; padding-top: 4mm; border-top: 1px solid #ddd; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9pt; color: #555; }
  .foot b { font-size: 11pt; color: #1a1a1a; }
  .brand { font-size: 8.5pt; color: #999; letter-spacing: .1em; }
</style></head>
<body><div class="page">
  ${imageDataUrl ? `<img class="hero" src="${imageDataUrl}" alt="">` : ""}
  <div class="head">
    <span class="cat">${esc(p.category.toUpperCase())} PACKAGE</span>
    <h1>${esc(p.name)}</h1>
    ${p.tagline ? `<p class="tag">${esc(p.tagline)}</p>` : ""}
  </div>

  <div class="grid">
    <div class="sec">
      <h2>こんな方に</h2>
      <p>${p.painPoints ? nl(p.painPoints) : "—"}</p>
      ${p.targetIndustries.length ? `<p style="margin-top:2mm;color:#666;font-size:9.5pt">対象: ${esc(p.targetIndustries.join("／"))}</p>` : ""}
    </div>
    <div class="sec">
      <h2>お届けするもの</h2>
      ${
        deliverables.length
          ? `<ul class="dl">${deliverables
              .map(
                (d) => `<li><span><span class="n">${esc(d.name)}</span>${d.spec ? `<span class="s">${esc(d.spec)}</span>` : ""}</span><span class="q">${d.qty}${esc(d.unit)}</span></li>`,
              )
              .join("")}</ul>`
          : `<p>${p.summary ? nl(p.summary) : "—"}</p>`
      }
      ${p.leadTime ? `<p style="margin-top:2.5mm;font-size:9.5pt;color:#444">納期の目安: ${esc(p.leadTime)}</p>` : ""}
    </div>

    <div class="price">
      <span class="l">PRICE</span>
      <span class="v">${esc(price)}</span>
      <span class="note">税抜${p.priceNote ? `／${esc(p.priceNote)}` : ""}</span>
    </div>

    <div class="sec">
      <h2>概要</h2>
      <p>${p.summary ? nl(p.summary) : "—"}</p>
    </div>
    <div class="sec">
      <h2>${options.length ? "追加オプション" : "進め方"}</h2>
      ${
        options.length
          ? `<ul>${options.map((o) => `<li><b>${esc(o.name)}</b>${o.price != null ? `　${yen(o.price)}` : ""}${o.note ? `<br><span style="font-size:9pt;color:#666">${esc(o.note)}</span>` : ""}</li>`).join("")}</ul>`
          : flow.length
            ? `<div class="flow"><ol>${flow.map((f) => `<li>${esc(f.task)}<span class="who">${CLIENT_OWNER_LABEL[f.owner]}</span></li>`).join("")}</ol></div>`
            : "<p>—</p>"
      }
    </div>
    ${
      options.length && flow.length
        ? `<div class="sec flow" style="grid-column:1/-1"><h2>進め方</h2><ol>${flow.map((f) => `<li>${esc(f.task)}<span class="who">${CLIENT_OWNER_LABEL[f.owner]}</span></li>`).join("")}</ol></div>`
        : ""
    }
  </div>

  <div class="foot">
    <div>
      <b>${esc(seller.company)}</b>${seller.name ? `　${esc(seller.name)}` : ""}<br>
      ${[seller.phone, seller.email].filter(Boolean).map((x) => esc(String(x))).join("　")}
    </div>
    <div class="brand">Ad Arch Group</div>
  </div>
</div></body></html>`;
}
