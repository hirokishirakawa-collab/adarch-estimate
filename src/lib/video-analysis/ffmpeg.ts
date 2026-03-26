import { execFile } from "child_process";
import { promisify } from "util";
import { mkdirSync, existsSync } from "fs";
import path from "path";
import type { VideoMeta } from "./types";

const exec = promisify(execFile);

/**
 * ffprobe で動画メタデータを取得
 */
export async function getVideoMeta(videoPath: string): Promise<VideoMeta> {
  const { stdout } = await exec("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    videoPath,
  ]);

  const data = JSON.parse(stdout);
  const videoStream = data.streams?.find(
    (s: { codec_type: string }) => s.codec_type === "video"
  );

  if (!videoStream) throw new Error("動画ストリームが見つかりません");

  const [num, den] = (videoStream.r_frame_rate || "30/1").split("/").map(Number);
  const fps = den ? num / den : 30;

  return {
    duration: parseFloat(data.format?.duration ?? videoStream.duration ?? "0"),
    fps,
    width: videoStream.width ?? 1920,
    height: videoStream.height ?? 1080,
  };
}

/**
 * 1fps でフレームを抽出し、指定ディレクトリに保存
 */
export async function extractFrames(
  videoPath: string,
  outputDir: string,
  fps: number = 1
): Promise<string[]> {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const pattern = path.join(outputDir, "frame_%05d.png");
  await exec("ffmpeg", [
    "-i", videoPath,
    "-vf", `fps=${fps}`,
    "-q:v", "2",
    pattern,
  ], { maxBuffer: 50 * 1024 * 1024 });

  // List generated frames
  const { stdout } = await exec("ls", ["-1", outputDir]);
  return stdout
    .trim()
    .split("\n")
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => path.join(outputDir, f));
}

/**
 * ffmpeg でシーン変更を検出
 * 戻り値: シーン変更のタイムスタンプ配列
 */
export async function detectSceneChanges(
  videoPath: string,
  threshold: number = 0.3
): Promise<number[]> {
  try {
    const { stderr } = await exec("ffmpeg", [
      "-i", videoPath,
      "-filter:v", `select='gt(scene,${threshold})',showinfo`,
      "-f", "null",
      "-",
    ], { maxBuffer: 50 * 1024 * 1024 });

    const timestamps: number[] = [0]; // always start at 0
    const regex = /pts_time:(\d+\.?\d*)/g;
    let match;
    while ((match = regex.exec(stderr)) !== null) {
      timestamps.push(parseFloat(match[1]));
    }
    return timestamps;
  } catch {
    // If ffmpeg returns non-zero (common with -f null), parse stderr
    return [0];
  }
}

/**
 * 特定タイムコードのフレームを1枚抽出
 */
export async function extractSingleFrame(
  videoPath: string,
  timecode: number,
  outputPath: string
): Promise<string> {
  const dir = path.dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  await exec("ffmpeg", [
    "-ss", timecode.toFixed(3),
    "-i", videoPath,
    "-frames:v", "1",
    "-y",
    outputPath,
  ]);

  return outputPath;
}
