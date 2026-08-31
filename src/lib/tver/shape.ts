// 市区町村の「土地のかたち」— 実データ（国土数値情報 N03 行政区域・簡略化版）からSVGを作る。サーバー専用・純粋
//   データ: src/data/tver-municipality-shapes.json（scripts/build-municipality-shapes.ts で生成）
//   複数市町村を選んだ依頼は全てのポリゴンを同じ塗りで重ねる＝合算した商圏のかたち（市町村の境界線も出る）
import shapesJson from "@/data/tver-municipality-shapes.json";

type Ring = number[][];
const SHAPES = shapesJson as Record<string, Ring[]>;

export function hasShape(codes: string[]): boolean {
  return codes.some((c) => (SHAPES[c]?.length ?? 0) > 0);
}

export interface ShapeSvgOptions {
  size?: number; // 出力の長辺（px）
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * 選択した市区町村コードの輪郭をSVG文字列にする。データが無ければ空文字。
 * 投影は簡易な正距円筒（緯度でx方向を cos 補正）＝チラシのシルエット用途には十分
 */
export function municipalityShapeSvg(codes: string[], o: ShapeSvgOptions = {}): string {
  const groups = codes.map((c) => SHAPES[c] ?? []).filter((g) => g.length > 0);
  if (groups.length === 0) return "";

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, latSum = 0, n = 0;
  for (const g of groups) for (const r of g) for (const [, y] of r) { latSum += y; n++; }
  const k = Math.cos((latSum / n) * Math.PI / 180);
  const proj = ([x, y]: number[]) => [x * k, -y];
  for (const g of groups) for (const r of g) for (const pt of r) {
    const [px, py] = proj(pt);
    if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
  }
  const size = o.size ?? 160;
  const sw = o.strokeWidth ?? 1.5;
  const pad = sw * 2;
  const w = maxX - minX, h = maxY - minY;
  const scale = (size - pad * 2) / Math.max(w, h);
  const vw = w * scale + pad * 2, vh = h * scale + pad * 2;
  const toPath = (r: Ring) =>
    r.map((pt, i) => {
      const [px, py] = proj(pt);
      return `${i === 0 ? "M" : "L"}${((px - minX) * scale + pad).toFixed(1)} ${((py - minY) * scale + pad).toFixed(1)}`;
    }).join("") + "Z";

  const fill = o.fill ?? "rgba(255,255,255,.28)";
  const stroke = o.stroke ?? "#fff";
  const ds = groups.map((g) => g.map(toPath).join(""));
  const fills = ds.map((d) => `<path d="${d}" fill="${fill}"/>`).join("");
  const lines = ds.map((d) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`).join("");
  return `<svg viewBox="0 0 ${vw.toFixed(1)} ${vh.toFixed(1)}" width="${vw.toFixed(0)}" height="${vh.toFixed(0)}"${o.className ? ` class="${o.className}"` : ""} aria-hidden="true">${fills}${lines}</svg>`;
}
