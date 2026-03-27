import { writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import type { AnalysisResult, DetectedChange, VideoMeta } from "./types";
import { getVideoMeta, extractFrames, extractSingleFrame } from "./ffmpeg";
import { compareFrames, compareHistograms } from "./frame-diff";
import { buildSceneSegments, matchScenes } from "./scene-match";
import { detectTelopChange } from "./telop-detect";
import { detectAnimationChanges, filterSignificantAnimationChanges } from "./animation-detect";
import { judgeChangesWithAI } from "./ai-judge";
import { downloadReviewVideo, uploadReviewFrame } from "@/lib/storage";

const TMP_BASE = "/tmp/video-review";

/**
 * メイン解析パイプライン
 */
export async function runAnalysisPipeline(
  reviewId: string,
  beforeVideoPath: string,
  afterVideoPath: string
): Promise<AnalysisResult> {
  const workDir = path.join(TMP_BASE, reviewId);
  const beforeDir = path.join(workDir, "before");
  const afterDir = path.join(workDir, "after");
  const diffDir = path.join(workDir, "diff");
  const beforeVideoFile = path.join(workDir, "before_video");
  const afterVideoFile = path.join(workDir, "after_video");

  try {
    // Ensure directories
    for (const d of [workDir, beforeDir, afterDir, diffDir]) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true });
    }

    // Download videos from Supabase
    console.log(`[analysis] Downloading videos for review ${reviewId}...`);
    const [beforeBuf, afterBuf] = await Promise.all([
      downloadReviewVideo(beforeVideoPath),
      downloadReviewVideo(afterVideoPath),
    ]);

    if (!beforeBuf || !afterBuf) {
      throw new Error("動画のダウンロードに失敗しました");
    }

    writeFileSync(beforeVideoFile, beforeBuf);
    writeFileSync(afterVideoFile, afterBuf);

    // Step 1: Get metadata
    console.log("[analysis] Getting video metadata...");
    const [beforeMeta, afterMeta] = await Promise.all([
      getVideoMeta(beforeVideoFile),
      getVideoMeta(afterVideoFile),
    ]);

    // Step 2: Extract frames at 1fps
    console.log("[analysis] Extracting frames...");
    const [beforeFrames, afterFrames] = await Promise.all([
      extractFrames(beforeVideoFile, beforeDir, 1),
      extractFrames(afterVideoFile, afterDir, 1),
    ]);

    console.log(`[analysis] Extracted ${beforeFrames.length} before / ${afterFrames.length} after frames`);

    const changes: DetectedChange[] = [];

    // Step 3: Detect duration change
    const durationDiff = Math.abs(afterMeta.duration - beforeMeta.duration);
    if (durationDiff > 0.5) {
      changes.push({
        type: "DURATION",
        timecodeIn: 0,
        timecodeOut: afterMeta.duration,
        description: `尺変更: ${formatTime(beforeMeta.duration)} → ${formatTime(afterMeta.duration)} (${durationDiff > 0 ? "+" : ""}${durationDiff.toFixed(1)}秒)`,
        confidence: 1.0,
      });
    }

    // Step 4: Scene matching
    console.log("[analysis] Building scene segments...");
    const [beforeScenes, afterScenes] = await Promise.all([
      buildSceneSegments(beforeVideoFile, beforeFrames, beforeMeta.duration),
      buildSceneSegments(afterVideoFile, afterFrames, afterMeta.duration),
    ]);

    const sceneMatches = matchScenes(beforeScenes, afterScenes);

    // Detect cut replacements (unmatched scenes)
    for (const match of sceneMatches) {
      if (match.similarity < 0.3) {
        changes.push({
          type: "CUT_REPLACE",
          timecodeIn: match.afterScene.startTime,
          timecodeOut: match.afterScene.endTime,
          description: `カット差し替え: ${formatTime(match.afterScene.startTime)}〜${formatTime(match.afterScene.endTime)}`,
          confidence: 1 - match.similarity,
        });
      }
    }

    // Step 5: Frame-by-frame comparison — ピクセル差分で候補を収集
    console.log("[analysis] Comparing frames (collecting candidates)...");
    const maxFrames = Math.min(beforeFrames.length, afterFrames.length);
    const frameMapping = buildFrameMapping(sceneMatches, beforeFrames.length, afterFrames.length);

    // 差分がある候補フレームを収集
    const candidates: { timecode: number; beforeFrame: string; afterFrame: string; diffRatio: number; diffImagePath?: string }[] = [];

    for (let ai = 0; ai < afterFrames.length && ai < maxFrames; ai++) {
      const bi = frameMapping[ai];
      if (bi === undefined || bi < 0 || bi >= beforeFrames.length) continue;

      const timecode = ai;

      const isCutReplaced = changes.some(
        (c) =>
          c.type === "CUT_REPLACE" &&
          timecode >= c.timecodeIn &&
          timecode <= (c.timecodeOut ?? c.timecodeIn)
      );
      if (isCutReplaced) continue;

      const diff = await compareFrames(
        beforeFrames[bi],
        afterFrames[ai],
        diffDir,
        ai,
        25
      );

      // 2%以上の差分がある候補のみ
      if (diff.diffRatio >= 0.02) {
        candidates.push({
          timecode,
          beforeFrame: beforeFrames[bi],
          afterFrame: afterFrames[ai],
          diffRatio: diff.diffRatio,
          diffImagePath: diff.diffImagePath,
        });
      }
    }

    console.log(`[analysis] Found ${candidates.length} candidate frames, sending to AI for judgment...`);

    // Step 5b: AI判定 — Claude Vision で意図的な修正かどうかを精査
    const hasDurationChange = durationDiff > 0.5;
    if (candidates.length > 0) {
      const aiChanges = await judgeChangesWithAI(
        candidates.map((c) => ({
          timecode: c.timecode,
          beforeFramePath: c.beforeFrame,
          afterFramePath: c.afterFrame,
          diffRatio: c.diffRatio,
        })),
        {
          hasDurationChange,
          durationDiff: afterMeta.duration - beforeMeta.duration,
        }
      );

      console.log(`[analysis] AI confirmed ${aiChanges.length} intentional changes`);

      // AI が確認した変更のフレーム画像を保存
      for (const change of aiChanges) {
        const candidate = candidates.find((c) => c.timecode === change.timecodeIn);
        if (candidate) {
          const framePaths = await saveFramePair(
            reviewId,
            candidate.beforeFrame,
            candidate.afterFrame,
            candidate.diffImagePath,
            candidate.timecode
          );
          changes.push({ ...change, ...framePaths });
        } else {
          changes.push(change);
        }
      }
    }

    // Step 6: Animation detection (optical flow)
    console.log("[analysis] Detecting animation changes...");
    try {
      const animDiffs = await detectAnimationChanges(beforeDir, afterDir, workDir);
      const significant = filterSignificantAnimationChanges(animDiffs, 1.0);

      for (const anim of significant) {
        // Skip if already covered by other change types
        const alreadyCovered = changes.some(
          (c) =>
            Math.abs(c.timecodeIn - anim.timecode) < 2
        );
        if (alreadyCovered) continue;

        changes.push({
          type: "ANIMATION",
          timecodeIn: anim.timecode,
          description: `アニメーション変更 (${formatTime(anim.timecode)}, 動き差分: ${anim.motionDiff.toFixed(2)})`,
          confidence: Math.min(anim.motionDiff / 3, 1),
        });
      }
    } catch (e) {
      console.warn("[analysis] Animation detection skipped:", e);
    }

    // Step 7: Merge nearby changes of the same type
    const mergedChanges = mergeNearbyChanges(changes);

    // Sort by timecode
    mergedChanges.sort((a, b) => a.timecodeIn - b.timecodeIn);

    console.log(`[analysis] Complete: ${mergedChanges.length} changes detected`);

    return {
      changes: mergedChanges,
      beforeMeta,
      afterMeta,
      sceneMatches,
    };
  } finally {
    // Cleanup temp files
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

/**
 * シーンマッチングに基づくフレーム対応マップ
 */
function buildFrameMapping(
  sceneMatches: { beforeScene: { startTime: number; endTime: number }; afterScene: { startTime: number; endTime: number }; similarity: number }[],
  beforeCount: number,
  afterCount: number
): number[] {
  const mapping = new Array(afterCount).fill(-1);

  for (const match of sceneMatches) {
    if (match.similarity < 0.3) continue; // Skip unmatched scenes

    const beforeStart = Math.floor(match.beforeScene.startTime);
    const beforeEnd = Math.min(Math.ceil(match.beforeScene.endTime), beforeCount);
    const afterStart = Math.floor(match.afterScene.startTime);
    const afterEnd = Math.min(Math.ceil(match.afterScene.endTime), afterCount);

    const beforeLen = beforeEnd - beforeStart;
    const afterLen = afterEnd - afterStart;

    for (let ai = afterStart; ai < afterEnd && ai < afterCount; ai++) {
      const progress = afterLen > 0 ? (ai - afterStart) / afterLen : 0;
      const bi = Math.min(beforeStart + Math.floor(progress * beforeLen), beforeCount - 1);
      mapping[ai] = bi;
    }
  }

  // Fill gaps with linear interpolation
  for (let i = 0; i < afterCount; i++) {
    if (mapping[i] < 0) {
      mapping[i] = Math.min(i, beforeCount - 1);
    }
  }

  return mapping;
}

/**
 * フレームペアをSupabaseにアップロード
 */
async function saveFramePair(
  reviewId: string,
  beforeFramePath: string,
  afterFramePath: string,
  diffFramePath: string | undefined,
  frameIndex: number
): Promise<{
  beforeFramePath?: string;
  afterFramePath?: string;
  diffFramePath?: string;
}> {
  const { readFileSync } = await import("fs");
  const result: {
    beforeFramePath?: string;
    afterFramePath?: string;
    diffFramePath?: string;
  } = {};

  try {
    const prefix = `${reviewId}/${frameIndex}`;
    const [before, after] = await Promise.all([
      uploadReviewFrame(readFileSync(beforeFramePath), `${prefix}_before.png`, reviewId),
      uploadReviewFrame(readFileSync(afterFramePath), `${prefix}_after.png`, reviewId),
    ]);
    result.beforeFramePath = before ?? undefined;
    result.afterFramePath = after ?? undefined;

    if (diffFramePath) {
      const diff = await uploadReviewFrame(
        readFileSync(diffFramePath),
        `${prefix}_diff.png`,
        reviewId
      );
      result.diffFramePath = diff ?? undefined;
    }
  } catch {
    // Non-critical, continue without frame images
  }

  return result;
}

/**
 * 近接する同タイプの変更を統合
 */
function mergeNearbyChanges(changes: DetectedChange[]): DetectedChange[] {
  if (changes.length === 0) return [];

  const sorted = [...changes].sort((a, b) => a.timecodeIn - b.timecodeIn);
  const merged: DetectedChange[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (
      next.type === current.type &&
      next.timecodeIn - (current.timecodeOut ?? current.timecodeIn) <= 2
    ) {
      // Merge
      current.timecodeOut = next.timecodeOut ?? next.timecodeIn;
      current.confidence = Math.max(current.confidence, next.confidence);
      // Keep the first frame paths if none on current
      if (!current.beforeFramePath) current.beforeFramePath = next.beforeFramePath;
      if (!current.afterFramePath) current.afterFramePath = next.afterFramePath;
      if (!current.diffFramePath) current.diffFramePath = next.diffFramePath;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  // Update descriptions for merged ranges
  for (const c of merged) {
    if (c.timecodeOut && c.timecodeOut > c.timecodeIn) {
      const typeLabel = CHANGE_TYPE_LABELS[c.type] || c.type;
      c.description = `${typeLabel} (${formatTime(c.timecodeIn)}〜${formatTime(c.timecodeOut)})`;
    }
  }

  return merged;
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  TELOP: "テロップ変更",
  CUT_REPLACE: "カット差し替え",
  COLOR: "色味変更",
  DURATION: "尺変更",
  ANIMATION: "アニメーション変更",
  OTHER: "映像変更",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
