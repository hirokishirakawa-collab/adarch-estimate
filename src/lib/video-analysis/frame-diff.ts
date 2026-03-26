import sharp from "sharp";
import path from "path";
import { mkdirSync, existsSync } from "fs";

interface DiffResult {
  diffRatio: number;  // 0-1: how different the frames are
  diffImagePath?: string;
  regions: { x: number; y: number; w: number; h: number }[];
}

/**
 * 2つのフレーム画像のピクセル差分を計算
 * diffRatio: 変更されたピクセルの割合（0=同一, 1=完全に異なる）
 */
export async function compareFrames(
  beforePath: string,
  afterPath: string,
  diffOutputDir?: string,
  frameIndex?: number,
  threshold: number = 30 // pixel difference threshold (0-255)
): Promise<DiffResult> {
  // Resize both to same dimensions for comparison
  const targetWidth = 640;
  const targetHeight = 360;

  const [beforeBuf, afterBuf] = await Promise.all([
    sharp(beforePath)
      .resize(targetWidth, targetHeight, { fit: "fill" })
      .raw()
      .toBuffer(),
    sharp(afterPath)
      .resize(targetWidth, targetHeight, { fit: "fill" })
      .raw()
      .toBuffer(),
  ]);

  const totalPixels = targetWidth * targetHeight;
  let diffCount = 0;
  const diffData = Buffer.alloc(targetWidth * targetHeight * 3);

  // Grid-based region detection (divide into 8x8 grid)
  const gridCols = 8;
  const gridRows = 8;
  const cellW = Math.floor(targetWidth / gridCols);
  const cellH = Math.floor(targetHeight / gridRows);
  const gridDiffs = Array.from({ length: gridRows }, () =>
    new Array(gridCols).fill(0)
  );
  const gridTotals = Array.from({ length: gridRows }, () =>
    new Array(gridCols).fill(0)
  );

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 3;
    const dr = Math.abs(beforeBuf[idx] - afterBuf[idx]);
    const dg = Math.abs(beforeBuf[idx + 1] - afterBuf[idx + 1]);
    const db = Math.abs(beforeBuf[idx + 2] - afterBuf[idx + 2]);
    const diff = (dr + dg + db) / 3;

    const px = i % targetWidth;
    const py = Math.floor(i / targetWidth);
    const gx = Math.min(Math.floor(px / cellW), gridCols - 1);
    const gy = Math.min(Math.floor(py / cellH), gridRows - 1);
    gridTotals[gy][gx]++;

    if (diff > threshold) {
      diffCount++;
      gridDiffs[gy][gx]++;
      // Red highlight for diff pixels
      diffData[idx] = 255;
      diffData[idx + 1] = 0;
      diffData[idx + 2] = 0;
    } else {
      // Dim version of after frame
      diffData[idx] = Math.floor(afterBuf[idx] * 0.3);
      diffData[idx + 1] = Math.floor(afterBuf[idx + 1] * 0.3);
      diffData[idx + 2] = Math.floor(afterBuf[idx + 2] * 0.3);
    }
  }

  // Find significant regions (cells with >15% change)
  const regions: { x: number; y: number; w: number; h: number }[] = [];
  for (let gy = 0; gy < gridRows; gy++) {
    for (let gx = 0; gx < gridCols; gx++) {
      const ratio = gridTotals[gy][gx] > 0
        ? gridDiffs[gy][gx] / gridTotals[gy][gx]
        : 0;
      if (ratio > 0.15) {
        regions.push({
          x: gx * cellW,
          y: gy * cellH,
          w: cellW,
          h: cellH,
        });
      }
    }
  }

  // Merge adjacent regions
  const mergedRegions = mergeRegions(regions);

  // Save diff image
  let diffImagePath: string | undefined;
  if (diffOutputDir && frameIndex !== undefined && diffCount > 0) {
    if (!existsSync(diffOutputDir)) mkdirSync(diffOutputDir, { recursive: true });
    diffImagePath = path.join(diffOutputDir, `diff_${String(frameIndex).padStart(5, "0")}.png`);
    await sharp(diffData, {
      raw: { width: targetWidth, height: targetHeight, channels: 3 },
    })
      .png()
      .toFile(diffImagePath);
  }

  return {
    diffRatio: diffCount / totalPixels,
    diffImagePath,
    regions: mergedRegions,
  };
}

/**
 * Merge adjacent bounding boxes
 */
function mergeRegions(
  regions: { x: number; y: number; w: number; h: number }[]
): { x: number; y: number; w: number; h: number }[] {
  if (regions.length === 0) return [];

  // Simple merge: combine overlapping/adjacent boxes
  const merged: { x: number; y: number; w: number; h: number }[] = [];
  const used = new Set<number>();

  for (let i = 0; i < regions.length; i++) {
    if (used.has(i)) continue;
    let { x, y, w, h } = regions[i];
    let x2 = x + w;
    let y2 = y + h;

    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < regions.length; j++) {
        if (used.has(j) || j === i) continue;
        const r = regions[j];
        const rx2 = r.x + r.w;
        const ry2 = r.y + r.h;
        // Check if adjacent or overlapping
        if (r.x <= x2 + 10 && rx2 >= x - 10 && r.y <= y2 + 10 && ry2 >= y - 10) {
          x = Math.min(x, r.x);
          y = Math.min(y, r.y);
          x2 = Math.max(x2, rx2);
          y2 = Math.max(y2, ry2);
          used.add(j);
          changed = true;
        }
      }
    }
    used.add(i);
    merged.push({ x, y, w: x2 - x, h: y2 - y });
  }

  return merged;
}

/**
 * 色ヒストグラム比較（RGB各チャネル）
 * 戻り値: 0-1（1 = 同一）
 */
export async function compareHistograms(
  beforePath: string,
  afterPath: string
): Promise<number> {
  const targetSize = 256;
  const bins = 32;

  const [beforeBuf, afterBuf] = await Promise.all([
    sharp(beforePath).resize(targetSize, targetSize, { fit: "fill" }).raw().toBuffer(),
    sharp(afterPath).resize(targetSize, targetSize, { fit: "fill" }).raw().toBuffer(),
  ]);

  const histBefore = buildHistogram(beforeBuf, bins);
  const histAfter  = buildHistogram(afterBuf, bins);

  return correlateHistograms(histBefore, histAfter);
}

function buildHistogram(buf: Buffer, bins: number): number[] {
  const hist = new Array(bins * 3).fill(0);
  const binSize = 256 / bins;
  const pixels = buf.length / 3;

  for (let i = 0; i < buf.length; i += 3) {
    hist[Math.floor(buf[i] / binSize)]++;
    hist[bins + Math.floor(buf[i + 1] / binSize)]++;
    hist[bins * 2 + Math.floor(buf[i + 2] / binSize)]++;
  }

  // Normalize
  for (let i = 0; i < hist.length; i++) hist[i] /= pixels;
  return hist;
}

function correlateHistograms(a: number[], b: number[]): number {
  const n = a.length;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  return den === 0 ? 1 : Math.max(0, num / den);
}
