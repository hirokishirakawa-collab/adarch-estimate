import sharp from "sharp";

/**
 * テロップ領域（画面下部1/3）の変更を検出
 * 戻り値: テロップ変更の差分度合い (0-1)
 */
export async function detectTelopChange(
  beforePath: string,
  afterPath: string
): Promise<{
  changed: boolean;
  diffRatio: number;
  region: { x: number; y: number; w: number; h: number } | null;
}> {
  const width = 640;
  const height = 360;
  const telopTop = Math.floor(height * 0.65); // bottom 35%
  const telopHeight = height - telopTop;

  const [beforeBuf, afterBuf] = await Promise.all([
    sharp(beforePath)
      .resize(width, height, { fit: "fill" })
      .extract({ left: 0, top: telopTop, width, height: telopHeight })
      .greyscale()
      .raw()
      .toBuffer(),
    sharp(afterPath)
      .resize(width, height, { fit: "fill" })
      .extract({ left: 0, top: telopTop, width, height: telopHeight })
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  // Compute edge maps using horizontal Sobel
  const beforeEdges = computeEdges(beforeBuf, width, telopHeight);
  const afterEdges = computeEdges(afterBuf, width, telopHeight);

  // Compare edge maps
  let diffCount = 0;
  const totalPixels = width * telopHeight;
  for (let i = 0; i < totalPixels; i++) {
    if (Math.abs(beforeEdges[i] - afterEdges[i]) > 40) {
      diffCount++;
    }
  }

  const diffRatio = diffCount / totalPixels;
  const changed = diffRatio > 0.03; // 3% edge change threshold

  return {
    changed,
    diffRatio,
    region: changed
      ? { x: 0, y: telopTop, w: width, h: telopHeight }
      : null,
  };
}

/**
 * Simple Sobel edge detection
 */
function computeEdges(buf: Buffer, width: number, height: number): Uint8Array {
  const edges = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Horizontal gradient
      const gx =
        -buf[(y - 1) * width + (x - 1)] +
        buf[(y - 1) * width + (x + 1)] +
        -2 * buf[y * width + (x - 1)] +
        2 * buf[y * width + (x + 1)] +
        -buf[(y + 1) * width + (x - 1)] +
        buf[(y + 1) * width + (x + 1)];

      // Vertical gradient
      const gy =
        -buf[(y - 1) * width + (x - 1)] +
        -2 * buf[(y - 1) * width + x] +
        -buf[(y - 1) * width + (x + 1)] +
        buf[(y + 1) * width + (x - 1)] +
        2 * buf[(y + 1) * width + x] +
        buf[(y + 1) * width + (x + 1)];

      edges[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }

  return edges;
}
