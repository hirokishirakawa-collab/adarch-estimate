import sharp from "sharp";
import type { SceneSegment, SceneMatch } from "./types";
import { detectSceneChanges } from "./ffmpeg";

/**
 * 動画のシーンを分割し、各シーンの特徴量を計算
 */
export async function buildSceneSegments(
  videoPath: string,
  framePaths: string[],
  duration: number,
  fps: number = 1
): Promise<SceneSegment[]> {
  const sceneTimestamps = await detectSceneChanges(videoPath, 0.25);

  // Add end timestamp
  const boundaries = [...sceneTimestamps, duration];

  const segments: SceneSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startTime = boundaries[i];
    const endTime = boundaries[i + 1];

    // Find the key frame closest to the midpoint
    const midTime = (startTime + endTime) / 2;
    const frameIdx = Math.min(
      Math.round(midTime * fps),
      framePaths.length - 1
    );
    if (frameIdx < 0 || frameIdx >= framePaths.length) continue;

    const keyFramePath = framePaths[frameIdx];
    const features = await computeFrameFeatures(keyFramePath);

    segments.push({
      index: i,
      startTime,
      endTime,
      keyFramePath,
      avgColor: features.avgColor,
      edgeScore: features.edgeScore,
    });
  }

  return segments;
}

/**
 * フレームの特徴量を計算（平均色 + エッジスコア）
 */
async function computeFrameFeatures(framePath: string): Promise<{
  avgColor: [number, number, number];
  edgeScore: number;
}> {
  const { data, info } = await sharp(framePath)
    .resize(128, 72, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Average color
  let r = 0, g = 0, b = 0;
  const pixels = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const avgColor: [number, number, number] = [
    r / pixels,
    g / pixels,
    b / pixels,
  ];

  // Simple edge score using Sobel-like horizontal differences
  let edgeSum = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 1; x < info.width; x++) {
      const idx = (y * info.width + x) * 3;
      const prev = (y * info.width + x - 1) * 3;
      edgeSum +=
        Math.abs(data[idx] - data[prev]) +
        Math.abs(data[idx + 1] - data[prev + 1]) +
        Math.abs(data[idx + 2] - data[prev + 2]);
    }
  }
  const edgeScore = edgeSum / (pixels * 3 * 255);

  return { avgColor, edgeScore };
}

/**
 * 修正前後のシーンをマッチング
 * 特徴量ベースのコスト最小化で対応関係を見つける
 */
export function matchScenes(
  beforeScenes: SceneSegment[],
  afterScenes: SceneSegment[]
): SceneMatch[] {
  const matches: SceneMatch[] = [];
  const usedBefore = new Set<number>();

  // Greedy matching: for each after scene, find best before match
  for (const afterScene of afterScenes) {
    let bestIdx = -1;
    let bestSim = -1;

    for (let i = 0; i < beforeScenes.length; i++) {
      if (usedBefore.has(i)) continue;
      const sim = sceneSimilarity(beforeScenes[i], afterScene);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestSim > 0.5) {
      matches.push({
        beforeScene: beforeScenes[bestIdx],
        afterScene,
        similarity: bestSim,
      });
      usedBefore.add(bestIdx);
    } else {
      // No match → this is a new/replaced scene
      matches.push({
        beforeScene: beforeScenes[0], // placeholder
        afterScene,
        similarity: 0,
      });
    }
  }

  return matches;
}

/**
 * 2つのシーン間の類似度を計算 (0-1)
 */
function sceneSimilarity(a: SceneSegment, b: SceneSegment): number {
  // Color distance (normalized to 0-1)
  const colorDist = Math.sqrt(
    (a.avgColor[0] - b.avgColor[0]) ** 2 +
    (a.avgColor[1] - b.avgColor[1]) ** 2 +
    (a.avgColor[2] - b.avgColor[2]) ** 2
  ) / (255 * Math.sqrt(3));

  // Edge score difference
  const edgeDiff = Math.abs(a.edgeScore - b.edgeScore);

  // Duration similarity
  const durA = a.endTime - a.startTime;
  const durB = b.endTime - b.startTime;
  const durSim = 1 - Math.abs(durA - durB) / Math.max(durA, durB, 1);

  // Weighted combination
  const colorSim = 1 - colorDist;
  const edgeSim = 1 - Math.min(edgeDiff * 5, 1);

  return colorSim * 0.5 + edgeSim * 0.3 + durSim * 0.2;
}
