// 本部チラシ制作サポートのサンプルPDFを書き出す（DB/ログイン不要）
//   OUT_DIR=/path [HERO_IMAGE=/path/to.jpg] [SKIP_REACTPDF=1] npx tsx scripts/render-tver-flyer-sample.tsx
//   HERO_IMAGE を渡すと唐津市の3テンプレに上部ビジュアルを差し込んだ版（*_hero.pdf）も出す／BLEED=1 で入稿用(塗り足し付きA4/A5)も出す
import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { buildFlyerData, type FlyerSource } from "@/lib/tver/flyer-data";
import { TverFlyerDocument } from "@/components/tver-flyer/tver-flyer-pdf";
import { buildFlyerHtml } from "@/lib/tver/flyer-html";
import { renderHtmlToPdf } from "@/lib/pdf/chrome";
import { normalizeHeroImage } from "@/lib/tver/hero-image";
import fs from "fs";
import { MUNICIPALITIES } from "@/data/tver-municipalities";
const f=(n:string)=>MUNICIPALITIES.find(m=>m.name===n)!.code;
const out=process.env.OUT_DIR ?? process.env.HOME + "/Desktop";
const TEMPLATES = ["orange", "classic", "poster"] as const;

async function renderAll(name: string, src: FlyerSource, reactPdf = true) {
  const d = buildFlyerData(src)!;
  if (reactPdf && !process.env.SKIP_REACTPDF) await renderToFile(<TverFlyerDocument data={d} />, `${out}/flyer_${name}_reactpdf.pdf`);
  for (const t of TEMPLATES) {
    const buf = await renderHtmlToPdf(buildFlyerHtml(d, t));
    if (buf) fs.writeFileSync(`${out}/flyer_${name}_${t}.pdf`, buf);
  }
  if (process.env.BLEED) {
    for (const size of ["A4", "A5"] as const) {
      const buf = await renderHtmlToPdf(buildFlyerHtml(d, "orange", { bleed: true, size }));
      if (buf) fs.writeFileSync(`${out}/flyer_${name}_orange_bleed_${size}.pdf`, buf);
    }
  }
}

async function main(){
  const a: FlyerSource = { municipalityCodes:[f("唐津市")], adSeconds:15, budget:null, clientName:"株式会社唐津リフォーム", industry:"リフォーム・建設",
    monthlyOverride:null,totalOverride:null, catchCopy:"「そろそろ家を直したい」と思う瞬間は、夜のテレビの前にあります。地元の会社として名前が思い浮かぶ状態を、3ヶ月かけてつくります。",
    issuerName:"Arete株式会社", issuerContact:"森永 090-0000-0000 / info@example.jp", deliveredAt:new Date(), createdAt:new Date() };
  await renderAll("karatsu", a);
  if (process.env.HERO_IMAGE) {
    const img = await normalizeHeroImage(fs.readFileSync(process.env.HERO_IMAGE));
    await renderAll("karatsu_hero", { ...a, heroImage: img.data, heroImageType: img.type }, false);
  }
  const b: FlyerSource = { municipalityCodes:[f("高松市"),f("丸亀市")], adSeconds:15, budget:500000, clientName:null, industry:null,
    monthlyOverride:null,totalOverride:null, catchCopy:null, issuerName:null, issuerContact:null, deliveredAt:null, createdAt:new Date() };
  await renderAll("takamatsu", b);
  console.log("ok");
}
main();
