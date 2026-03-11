export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { google } from "googleapis";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SceneChange {
  timestamp: number; // seconds
  score: number; // scene change score (0-1)
  thumbnailPath: string;
}

interface CutEntry {
  cutNumber: number;
  thumbnailDriveUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  sceneDescription: string;
  narration: string;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format seconds to HH:MM:SS.mmm timecode */
function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

/** Build a Google Auth client using service account with domain-wide delegation */
function getGoogleAuth(delegatedEmail: string) {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON が設定されていません");

  const credentials = JSON.parse(saJson);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
    subject: delegatedEmail,
  });
  return auth;
}

/** Detect scene changes and extract thumbnail frames via FFmpeg.
 *
 *  Strategy:
 *    1. 低しきい値（0.08）で候補を多めに検出し、各フレームの scene スコアを取得
 *    2. 近すぎるカット（MIN_INTERVAL 秒未満）をスコアが高い方に統合
 *    3. スコア中央値の半分以下の弱いカットを除外（明確なカット切替だけ残す）
 */
function detectScenes(
  videoPath: string,
  workDir: string,
  threshold: number = 0.08,
): SceneChange[] {
  const MIN_INTERVAL = 0.3; // 最小カット間隔（秒）

  // scene スコア付きで全フレームを検出
  const detectCmd = `ffmpeg -i "${videoPath}" -filter:v "select='gt(scene,${threshold})',metadata=print:file=-" -f null - 2>&1`;
  const detectOutput = execSync(detectCmd, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: 120_000,
  });

  // showinfo の pts_time を取得（metadata=print ではなくshowinfo経由）
  // metadata=print が使えない場合のフォールバックとして showinfo も併用
  const detectCmd2 = `ffmpeg -i "${videoPath}" -filter:v "select='gt(scene,${threshold})',showinfo" -f null - 2>&1`;
  const detectOutput2 = execSync(detectCmd2, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: 120_000,
  });

  // Parse pts_time and scene score from showinfo output
  // showinfo format: ... pts_time:1.234 ...
  // metadata print format: lavfi.scene_score=0.456
  const candidates: { timestamp: number; score: number }[] = [];

  // Extract timestamps from showinfo
  const tsRegex = /\[Parsed_showinfo.*\] n:\s*\d+.*pts_time:(\d+\.?\d*)/g;
  const timestamps: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = tsRegex.exec(detectOutput2)) !== null) {
    timestamps.push(parseFloat(match[1]));
  }

  // Extract scene scores from metadata output
  const scoreRegex = /lavfi\.scene_score=(\d+\.?\d*)/g;
  const scores: number[] = [];
  while ((match = scoreRegex.exec(detectOutput)) !== null) {
    scores.push(parseFloat(match[1]));
  }

  // Pair timestamps with scores
  for (let i = 0; i < timestamps.length; i++) {
    candidates.push({
      timestamp: timestamps[i],
      score: i < scores.length ? scores[i] : threshold,
    });
  }

  console.log(`[cutsheet] Raw candidates: ${candidates.length} (threshold=${threshold})`);

  // Always include frame 0
  if (candidates.length === 0 || candidates[0].timestamp > 0.5) {
    candidates.unshift({ timestamp: 0, score: 1.0 });
  }

  // --- Filter 1: 近すぎるカットを統合（スコアが高い方を残す）---
  const merged: { timestamp: number; score: number }[] = [];
  for (const c of candidates) {
    if (merged.length === 0) {
      merged.push(c);
      continue;
    }
    const last = merged[merged.length - 1];
    if (c.timestamp - last.timestamp < MIN_INTERVAL) {
      // 近すぎる → スコアが高い方を残す
      if (c.score > last.score) {
        merged[merged.length - 1] = c;
      }
    } else {
      merged.push(c);
    }
  }

  // --- Filter 2: スコアが弱すぎるカットを除外 ---
  // 中央値の40%未満のスコアは除外（ただし先頭フレームとスコア上位は常に残す）
  const sortedScores = merged.map((m) => m.score).sort((a, b) => a - b);
  const median = sortedScores[Math.floor(sortedScores.length / 2)] ?? threshold;
  const scoreFloor = median * 0.4;

  const filtered = merged.filter(
    (c, i) => i === 0 || c.score >= scoreFloor,
  );

  console.log(
    `[cutsheet] After filtering: ${filtered.length} cuts (merged=${merged.length}, scoreFloor=${scoreFloor.toFixed(3)}, median=${median.toFixed(3)})`,
  );

  // Extract thumbnail for each remaining scene
  const scenes: SceneChange[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const { timestamp, score } = filtered[i];
    const thumbPath = join(workDir, `thumb_${String(i).padStart(4, "0")}.jpg`);
    execSync(
      `ffmpeg -ss ${timestamp} -i "${videoPath}" -frames:v 1 -q:v 2 "${thumbPath}" -y`,
      { timeout: 30_000, stdio: "pipe" },
    );
    scenes.push({ timestamp, score, thumbnailPath: thumbPath });
  }

  return scenes;
}

/** Extract audio as MP3 from video */
function extractAudio(videoPath: string, workDir: string): string {
  const audioPath = join(workDir, "audio.mp3");
  execSync(
    `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -q:a 4 "${audioPath}" -y`,
    { timeout: 120_000, stdio: "pipe" },
  );
  return audioPath;
}

/** Get video duration via ffprobe */
function getVideoDuration(videoPath: string): number {
  const output = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`,
    { encoding: "utf-8", timeout: 15_000 },
  ).trim();
  return parseFloat(output);
}

/** Transcribe audio using OpenAI Whisper with word-level timestamps */
async function transcribeAudio(
  audioPath: string,
): Promise<WhisperWord[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const audioFile = await readFile(audioPath);
  const file = new File([audioFile], "audio.mp3", { type: "audio/mpeg" });

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "ja",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = response as any;
  const words: WhisperWord[] = (data.words ?? []).map(
    (w: { word: string; start: number; end: number }) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }),
  );

  return words;
}

/** Get words that overlap with a given time range */
function getWordsForRange(
  words: WhisperWord[],
  start: number,
  end: number,
): string {
  const relevant = words.filter(
    (w) => w.start < end && w.end > start,
  );
  return relevant.map((w) => w.word).join("");
}

/** Analyze a thumbnail image with Claude and generate scene description in Japanese */
async function analyzeScene(
  thumbnailPath: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const imageData = await readFile(thumbnailPath);
  const base64 = imageData.toString("base64");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64,
            },
          },
          {
            type: "text",
            text: "この映像のワンシーンを日本語で1〜2文で簡潔に説明してください。映像制作のカット表に記載する「シーン説明」として使います。",
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  return content.type === "text" ? content.text.trim() : "";
}

/** Upload thumbnail to Google Drive and return a viewable URL */
async function uploadThumbnailToDrive(
  authClient: InstanceType<typeof google.auth.JWT>,
  filePath: string,
  fileName: string,
  folderId: string,
): Promise<string> {
  const drive = google.drive({ version: "v3", auth: authClient });
  const imageData = await readFile(filePath);

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: "image/jpeg",
    body: require("stream").Readable.from(imageData),
  };

  const uploaded = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id",
  });

  const fileId = uploaded.data.id!;

  // Make the file viewable by anyone with the link
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/** Create a Google Spreadsheet with cut sheet data */
async function createCutSheet(
  authClient: InstanceType<typeof google.auth.JWT>,
  cuts: CutEntry[],
  videoName: string,
): Promise<string> {
  const sheets = google.sheets({ version: "v4", auth: authClient });

  // Create a new spreadsheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `カット表 - ${videoName} - ${new Date().toISOString().slice(0, 10)}`,
      },
      sheets: [
        {
          properties: {
            title: "カット表",
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;
  const sheetId = spreadsheet.data.sheets![0].properties!.sheetId!;

  // Header row
  const headerRow = [
    "カット#",
    "サムネイル",
    "開始",
    "終了",
    "秒数",
    "シーン説明",
    "ナレーション/SE",
  ];

  // Data rows
  const dataRows = cuts.map((cut) => [
    cut.cutNumber,
    `=IMAGE("${cut.thumbnailDriveUrl}")`,
    formatTimecode(cut.startTime),
    formatTimecode(cut.endTime),
    Math.round(cut.duration * 10) / 10,
    cut.sceneDescription,
    cut.narration,
  ]);

  const allRows = [headerRow, ...dataRows];

  // Write data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "カット表!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: allRows,
    },
  });

  // Format: set column widths and row heights for thumbnails
  const requests = [
    // Header formatting (bold, background color)
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields:
          "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)",
      },
    },
    // Column B (thumbnail) width
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 1,
          endIndex: 2,
        },
        properties: { pixelSize: 240 },
        fields: "pixelSize",
      },
    },
    // Column F (scene description) width
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 5,
          endIndex: 6,
        },
        properties: { pixelSize: 300 },
        fields: "pixelSize",
      },
    },
    // Column G (narration) width
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 6,
          endIndex: 7,
        },
        properties: { pixelSize: 300 },
        fields: "pixelSize",
      },
    },
    // Row heights for thumbnail rows
    ...cuts.map((_, i) => ({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: i + 1,
          endIndex: i + 2,
        },
        properties: { pixelSize: 135 },
        fields: "pixelSize",
      },
    })),
    // Wrap text for description and narration columns
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: 5,
          endColumnIndex: 7,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: "WRAP",
            verticalAlignment: "TOP",
          },
        },
        fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
      },
    },
    // Center-align timecode / duration columns
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: 2,
          endColumnIndex: 5,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)",
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

// ---------------------------------------------------------------------------
// POST /api/cutsheet
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  // --- Auth ---
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // --- 機能許可チェック（ADMINは常にアクセス可） ---
  const role = (session.user as { role?: string }).role ?? "USER";
  if (role !== "ADMIN") {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { enabledFeatures: true },
    });
    if (!user?.enabledFeatures.includes("cutsheet")) {
      return NextResponse.json(
        { error: "この機能はADMINによる許可が必要です" },
        { status: 403 }
      );
    }
  }

  // --- Rate limit ---
  const rateLimitRes = checkRateLimit(session.user.email, "cutsheet", AI_RATE_LIMIT);
  if (rateLimitRes) return rateLimitRes;

  // --- Env check ---
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY が設定されていません" }, { status: 500 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(
      { error: "GOOGLE_SERVICE_ACCOUNT_JSON が設定されていません" },
      { status: 500 },
    );
  }

  const driveFolderId = process.env.GDRIVE_CUTSHEET_FOLDER_ID;
  if (!driveFolderId) {
    return NextResponse.json(
      { error: "GDRIVE_CUTSHEET_FOLDER_ID が設定されていません" },
      { status: 500 },
    );
  }

  // --- Parse FormData ---
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData の解析に失敗しました" }, { status: 400 });
  }

  const videoFile = formData.get("video") as File | null;
  if (!videoFile) {
    return NextResponse.json({ error: "動画ファイル (video) が必要です" }, { status: 400 });
  }

  const allowedTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/mpeg"];
  if (!allowedTypes.includes(videoFile.type)) {
    return NextResponse.json(
      { error: "対応形式: MP4, MOV, AVI, WebM, MPEG" },
      { status: 400 },
    );
  }

  // Max 500MB
  const MAX_SIZE = 500 * 1024 * 1024;
  if (videoFile.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "ファイルサイズは500MB以下にしてください" },
      { status: 400 },
    );
  }

  const workDir = join(tmpdir(), `cutsheet-${randomUUID()}`);

  try {
    await mkdir(workDir, { recursive: true });

    // --- Save video to temp file ---
    const ext = videoFile.name?.split(".").pop() ?? "mp4";
    const videoPath = join(workDir, `input.${ext}`);
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await writeFile(videoPath, videoBuffer);

    console.log(`[cutsheet] Video saved: ${videoPath} (${(videoFile.size / 1024 / 1024).toFixed(1)}MB)`);

    // --- Get video duration ---
    const totalDuration = getVideoDuration(videoPath);
    console.log(`[cutsheet] Duration: ${totalDuration.toFixed(1)}s`);

    // --- Detect scene changes ---
    // 低しきい値で多めに検出→スコアベースで自動フィルタリング
    const scenes = detectScenes(videoPath, workDir);
    console.log(`[cutsheet] Scenes detected: ${scenes.length}`);

    if (scenes.length === 0) {
      return NextResponse.json(
        { error: "シーンチェンジが検出されませんでした" },
        { status: 400 },
      );
    }

    // --- Extract audio & transcribe ---
    const audioPath = extractAudio(videoPath, workDir);
    console.log("[cutsheet] Audio extracted");

    const words = await transcribeAudio(audioPath);
    console.log(`[cutsheet] Transcription: ${words.length} words`);

    // --- Google Auth ---
    const googleAuth = getGoogleAuth(session.user.email);

    // --- Create a subfolder in Drive for this session's thumbnails ---
    const drive = google.drive({ version: "v3", auth: googleAuth });
    const subfolder = await drive.files.create({
      requestBody: {
        name: `カット表_${videoFile.name}_${Date.now()}`,
        mimeType: "application/vnd.google-apps.folder",
        parents: [driveFolderId],
      },
      fields: "id",
    });
    const thumbnailFolderId = subfolder.data.id!;

    // --- Process each scene: upload thumbnail, analyze with Claude ---
    const cuts: CutEntry[] = [];

    // Process scenes in batches of 5 to avoid overwhelming APIs
    const BATCH_SIZE = 5;
    for (let batchStart = 0; batchStart < scenes.length; batchStart += BATCH_SIZE) {
      const batch = scenes.slice(batchStart, batchStart + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (scene, batchIdx) => {
          const i = batchStart + batchIdx;
          const startTime = scene.timestamp;
          const endTime =
            i + 1 < scenes.length ? scenes[i + 1].timestamp : totalDuration;
          const duration = endTime - startTime;

          // Upload thumbnail to Drive
          const thumbFileName = `cut_${String(i + 1).padStart(3, "0")}.jpg`;
          const thumbnailDriveUrl = await uploadThumbnailToDrive(
            googleAuth,
            scene.thumbnailPath,
            thumbFileName,
            thumbnailFolderId,
          );

          // Analyze scene with Claude
          const sceneDescription = await analyzeScene(scene.thumbnailPath);

          // Get narration for this time range
          const narration = getWordsForRange(words, startTime, endTime);

          return {
            cutNumber: i + 1,
            thumbnailDriveUrl,
            startTime,
            endTime,
            duration,
            sceneDescription,
            narration,
          } satisfies CutEntry;
        }),
      );

      cuts.push(...batchResults);
    }

    console.log(`[cutsheet] ${cuts.length} cuts processed`);

    // --- Create Google Spreadsheet ---
    const videoName = videoFile.name?.replace(/\.[^.]+$/, "") ?? "動画";
    const sheetUrl = await createCutSheet(googleAuth, cuts, videoName);
    console.log(`[cutsheet] Spreadsheet created: ${sheetUrl}`);

    return NextResponse.json({
      url: sheetUrl,
      cuts: cuts.length,
      duration: totalDuration,
    });
  } catch (err) {
    console.error("[cutsheet] Error:", err);
    const message =
      err instanceof Error ? err.message : "カット表の作成中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // --- Cleanup temp files ---
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      console.warn(`[cutsheet] Failed to clean up: ${workDir}`);
    }
  }
}
