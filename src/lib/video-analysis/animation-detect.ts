import { execFile } from "child_process";
import { promisify } from "util";
import { readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const exec = promisify(execFile);

interface AnimationDiff {
  frameIndex: number;
  timecode: number;
  motionDiff: number;
  beforeMotion: number;
  afterMotion: number;
}

/**
 * Python スクリプトでオプティカルフロー差分を検出
 */
export async function detectAnimationChanges(
  beforeFrameDir: string,
  afterFrameDir: string,
  workDir: string
): Promise<AnimationDiff[]> {
  if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

  const outputJson = path.join(workDir, "optical_flow_result.json");
  const scriptPath = path.join(
    process.cwd(),
    "src/lib/video-analysis/scripts/optical_flow.py"
  );

  try {
    await exec("python3", [scriptPath, beforeFrameDir, afterFrameDir, outputJson], {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (!existsSync(outputJson)) return [];

    const results: AnimationDiff[] = JSON.parse(
      readFileSync(outputJson, "utf-8")
    ).map((r: { frame_index: number; timecode: number; motion_diff: number; before_motion: number; after_motion: number }) => ({
      frameIndex: r.frame_index,
      timecode: r.timecode,
      motionDiff: r.motion_diff,
      beforeMotion: r.before_motion,
      afterMotion: r.after_motion,
    }));

    return results;
  } catch (e) {
    console.error("[animation-detect] Python script failed:", e);
    return [];
  }
}

/**
 * アニメーション変更のフィルタリング
 * motionDiff が閾値以上のフレームのみ返す
 */
export function filterSignificantAnimationChanges(
  diffs: AnimationDiff[],
  threshold: number = 0.8
): AnimationDiff[] {
  return diffs.filter((d) => d.motionDiff > threshold);
}
