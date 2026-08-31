// 市区町村の輪郭データを作る（TVerチラシの「土地のかたち」用）
//   出典: 国土数値情報 行政区域データ N03-21（2021-01-01）を smartnews-smri/japan-topography が簡略化したもの（s0010）
//   使い方: npx tsx scripts/build-municipality-shapes.ts  → src/data/tver-municipality-shapes.json
//   形式: { [5桁コード]: number[][][] }  … ポリゴン外周リングの配列（[lon,lat]・小数4桁・穴は捨てる）
import fs from "fs";
import path from "path";

const BASE = "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010";
const OUT = path.join(process.cwd(), "src/data/tver-municipality-shapes.json");

type Ring = number[][];
const shapes: Record<string, Ring[]> = {};

async function main() {
  for (let p = 1; p <= 47; p++) {
    const pref = String(p).padStart(2, "0");
    const url = `${BASE}/N03-21_${pref}_210101.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const gj = (await res.json()) as { features: { properties: Record<string, string | null>; geometry: { type: string; coordinates: unknown } }[] };
    let n = 0;
    for (const f of gj.features) {
      const code = f.properties.N03_007;
      if (!code) continue;
      const polys: number[][][][] =
        f.geometry.type === "Polygon" ? [f.geometry.coordinates as number[][][]] :
        f.geometry.type === "MultiPolygon" ? (f.geometry.coordinates as number[][][][]) : [];
      const rings = polys
        .map((poly) => poly[0].map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]))
        .filter((r) => r.length >= 4);
      if (rings.length === 0) continue;
      (shapes[code] ??= []).push(...rings); // 同一コードが複数featureに分かれていることがある（飛び地）
      n++;
    }
    console.log(pref, n, "features");
  }
  fs.writeFileSync(OUT, JSON.stringify(shapes));
  console.log("wrote", OUT, Object.keys(shapes).length, "codes", (fs.statSync(OUT).size / 1024 / 1024).toFixed(1), "MB");
}
main();
