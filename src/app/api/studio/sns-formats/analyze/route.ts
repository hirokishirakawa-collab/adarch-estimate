import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.branchId) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  const { url, sourceViews } = await req.json();
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    // Step 1: Download video via yt-dlp (server-side)
    const { execSync } = await import("child_process");
    const tmpDir = `/tmp/sns_analyze_${Date.now()}`;
    execSync(`mkdir -p ${tmpDir}/frames`);

    // Download (try yt-dlp command first, fallback to python module)
    try {
      execSync(
        `yt-dlp --no-check-certificates --no-warnings -o "${tmpDir}/video.%(ext)s" "${url}" 2>&1 || python3 -m yt_dlp --no-check-certificates --no-warnings -o "${tmpDir}/video.%(ext)s" "${url}" 2>&1`,
        { timeout: 120000, stdio: "pipe", shell: "/bin/sh" }
      );
    } catch (dlErr: any) {
      const msg = dlErr.stderr?.toString() || dlErr.stdout?.toString() || dlErr.message || "";
      return NextResponse.json({
        error: "動画のダウンロードに失敗しました。URLを確認してください。",
        detail: msg.slice(0, 300),
      }, { status: 400 });
    }

    // Find downloaded file
    const videoFile = execSync(`ls ${tmpDir}/video.* | head -1`).toString().trim();
    if (!videoFile) {
      return NextResponse.json({ error: "動画ファイルが見つかりません" }, { status: 500 });
    }

    // Step 2: Get video info
    const probeJson = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${videoFile}"`,
      { stdio: "pipe" }
    ).toString();
    const probe = JSON.parse(probeJson);
    const duration = parseFloat(probe.format.duration);
    const width = probe.streams[0].width;
    const height = probe.streams[0].height;

    // Step 3: Scene detection
    const sceneOutput = execSync(
      `ffmpeg -i "${videoFile}" -filter:v "select='gt(scene,0.3)',showinfo" -vsync vfr -f null - 2>&1 | grep "pts_time" || true`,
      { stdio: "pipe", timeout: 30000 }
    ).toString();

    const cutPoints = [0];
    const matches = sceneOutput.matchAll(/pts_time:([\d.]+)/g);
    for (const m of matches) {
      cutPoints.push(parseFloat(m[1]));
    }
    cutPoints.push(duration);

    // Step 4: Extract frames at cut points + regular intervals
    execSync(
      `ffmpeg -y -i "${videoFile}" -vf "select='eq(n\\,0)+gt(scene\\,0.3)',scale=540:-1" -vsync vfr "${tmpDir}/frames/cut_%03d.jpg" 2>/dev/null || true`,
      { timeout: 30000 }
    );
    execSync(
      `ffmpeg -y -i "${videoFile}" -vf "fps=1/${Math.max(3, Math.floor(duration / 8))},scale=540:-1" "${tmpDir}/frames/sample_%03d.jpg" 2>/dev/null || true`,
      { timeout: 30000 }
    );

    // Step 5: Read frames as base64 for Claude Vision
    const fs = await import("fs");
    const path = await import("path");
    const frameFiles = fs.readdirSync(`${tmpDir}/frames`).sort().slice(0, 12); // Max 12 frames
    const frameImages = frameFiles.map((f: string) => {
      const data = fs.readFileSync(path.join(`${tmpDir}/frames`, f));
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: "image/jpeg" as const,
          data: data.toString("base64"),
        },
      };
    });

    // Pick representative thumbnail (middle frame = highlight area)
    const thumbIndex = Math.min(Math.floor(frameFiles.length * 0.6), frameFiles.length - 1);
    const thumbData = fs.readFileSync(path.join(`${tmpDir}/frames`, frameFiles[thumbIndex]));
    const thumbnailBase64 = `data:image/jpeg;base64,${thumbData.toString("base64")}`;

    // Step 6: Claude Vision analysis
    const analysisPrompt = `あなたはSNS動画のフォーマット分析の専門家です。以下のフレーム画像は1本のSNS動画（${duration.toFixed(1)}秒、${width}x${height}）から抽出したものです。
カット変化点の秒数: ${cutPoints.map(c => c.toFixed(1)).join(", ")}

以下のJSON形式で動画の構成を分析してください。必ずJSON形式のみで回答してください：

{
  "title": "このフォーマットの名前（日本語、簡潔に）",
  "industry": "業種（beauty/food/gym/medical/dental/fashion/general等）",
  "taste": "テイスト（trust/stylish/pop/clean/casual/energetic）",
  "duration": "尺（例: 15秒、30秒、60秒 → 最も近いものに丸める）",
  "description": "このフォーマットの説明（40文字以内）",
  "platforms": ["reel", "tiktok"],
  "structure": [
    {"label": "セクション名", "duration": "Ns", "type": "intro/main1/main2/highlight/cta"},
    ...
  ],
  "telop_analysis": {
    "main_style": "テロップのメインスタイル説明",
    "position": "配置位置（top/center/bottom）",
    "font_style": "フォントの特徴",
    "color": "テロップの色",
    "background": "背景の有無と色",
    "animation": "アニメーションの有無"
  },
  "recommended_telops": ["テロップスタイルID候補4つ（subtitle_bar, solid_white, tiktok_bold, handwritten, pop_yellow, minimal_serif, beauty_before, beauty_after, frosted_glass等から選択）"],
  "shooting_tips": "この動画を再現するための撮影のコツ（100文字以内）",
  "hook_technique": "冒頭のフック技法の説明（50文字以内）"
}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            ...frameImages,
            { type: "text", text: analysisPrompt },
          ],
        },
      ],
    });

    const analysisText = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "解析結果のパースに失敗しました", raw: analysisText }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Step 7: Build format template
    const TYPE_COLORS: Record<string, string> = {
      intro: "rgba(139,92,246,.5)",
      main1: "rgba(59,130,246,.4)",
      main2: "rgba(59,130,246,.3)",
      highlight: "rgba(236,72,153,.45)",
      cta: "rgba(16,185,129,.4)",
    };

    const formatTemplate = {
      id: `analyzed_${Date.now()}`,
      nm: analysis.title,
      ind: analysis.industry,
      taste: analysis.taste,
      pf: analysis.platforms,
      dur: analysis.duration,
      desc: analysis.description,
      st: analysis.structure.map((s: any) => ({
        l: s.label,
        d: s.duration,
        c: TYPE_COLORS[s.type] || TYPE_COLORS.main1,
      })),
      telops: analysis.recommended_telops,
      rtlp: analysis.recommended_telops[0],
      telop_analysis: analysis.telop_analysis,
      shooting_tips: analysis.shooting_tips,
      hook_technique: analysis.hook_technique,
      source_url: url,
      source_duration: duration,
      source_resolution: `${width}x${height}`,
      cut_points: cutPoints,
    };

    // Save to DB
    const saved = await prisma.snsReferenceFormat.create({
      data: {
        sourceUrl: url,
        sourceViews: sourceViews ? parseInt(sourceViews) : null,
        thumbnailBase64,
        sourceDuration: duration,
        sourceResolution: `${width}x${height}`,
        title: analysis.title,
        description: analysis.description,
        industry: analysis.industry,
        taste: analysis.taste,
        duration: analysis.duration,
        platforms: analysis.platforms.join(","),
        structure: analysis.structure,
        cutPoints: cutPoints,
        telopAnalysis: analysis.telop_analysis,
        recommendedTelops: analysis.recommended_telops.join(","),
        hookTechnique: analysis.hook_technique,
        shootingTips: analysis.shooting_tips,
        branchId: user.branchId!,
        createdById: user.id,
      },
    });

    // Cleanup
    execSync(`rm -rf ${tmpDir}`);

    return NextResponse.json({ ...formatTemplate, savedId: saved.id, thumbnailBase64 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "解析エラー" }, { status: 500 });
  }
}

// 履歴一覧
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.branchId) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  const isAdmin = user.role === "ADMIN";
  const refs = await prisma.snsReferenceFormat.findMany({
    where: isAdmin ? {} : { branchId: user.branchId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json(refs);
}
