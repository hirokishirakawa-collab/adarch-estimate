// 本部チラシ制作サポートのサンプルPDFを書き出す（DB/ログイン不要）: OUT_DIR=/path npx tsx scripts/render-tver-flyer-sample.tsx
import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { buildFlyerData } from "@/lib/tver/flyer-data";
import { TverFlyerDocument } from "@/components/tver-flyer/tver-flyer-pdf";
import { buildFlyerHtml } from "@/lib/tver/flyer-html";
import { renderHtmlToPdf } from "@/lib/pdf/chrome";
import fs from "fs";
import { MUNICIPALITIES } from "@/data/tver-municipalities";
const f=(n:string)=>MUNICIPALITIES.find(m=>m.name===n)!.code;
const out=process.env.OUT_DIR ?? process.env.HOME + "/Desktop";
async function main(){
  const a = buildFlyerData({ municipalityCodes:[f("唐津市")], adSeconds:15, budget:null, clientName:"株式会社唐津リフォーム", industry:"リフォーム・建設",
    monthlyOverride:null,totalOverride:null, catchCopy:"「そろそろ家を直したい」と思う瞬間は、夜のテレビの前にあります。地元の会社として名前が思い浮かぶ状態を、3ヶ月かけてつくります。",
    issuerName:"Arete株式会社", issuerContact:"森永 090-0000-0000 / info@example.jp", deliveredAt:new Date(), createdAt:new Date() })!;
  await renderToFile(<TverFlyerDocument data={a} />, `${out}/flyer_karatsu_reactpdf.pdf`);
  for (const t of ["classic", "poster", "orange"] as const) {
    const buf = await renderHtmlToPdf(buildFlyerHtml(a, t));
    if (buf) fs.writeFileSync(`${out}/flyer_karatsu_${t}.pdf`, buf);
  }
  const b = buildFlyerData({ municipalityCodes:[f("高松市"),f("丸亀市")], adSeconds:15, budget:500000, clientName:null, industry:null,
    monthlyOverride:null,totalOverride:null, catchCopy:null, issuerName:null, issuerContact:null, deliveredAt:null, createdAt:new Date() })!;
  await renderToFile(<TverFlyerDocument data={b} />, `${out}/flyer_takamatsu_reactpdf.pdf`);
  for (const t of ["classic", "poster", "orange"] as const) {
    const buf = await renderHtmlToPdf(buildFlyerHtml(b, t));
    if (buf) fs.writeFileSync(`${out}/flyer_takamatsu_${t}.pdf`, buf);
  }
  console.log("ok");
}
main();
