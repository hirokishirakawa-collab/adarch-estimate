import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Whisper API (OpenAI) for transcription
const WHISPER_API = "https://api.openai.com/v1/audio/transcriptions";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !user.branchId) return NextResponse.json({ error: "No branch" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const studioClientId = formData.get("studioClientId") as string | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  // Forward to Whisper API
  const whisperForm = new FormData();
  whisperForm.append("file", file);
  whisperForm.append("model", "whisper-1");
  whisperForm.append("response_format", "srt");
  whisperForm.append("language", "ja");

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    // Fallback: return message that OpenAI key is needed
    return NextResponse.json({
      error: "OPENAI_API_KEY not configured",
      message: "自動字幕生成にはOpenAI APIキーが必要です。環境変数 OPENAI_API_KEY を設定してください。",
    }, { status: 500 });
  }

  const whisperRes = await fetch(WHISPER_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: whisperForm,
  });

  if (!whisperRes.ok) {
    const err = await whisperRes.text();
    return NextResponse.json({ error: "Whisper API error", detail: err }, { status: 500 });
  }

  const srt = await whisperRes.text();

  // Save to DB
  if (studioClientId) {
    await prisma.production.create({
      data: {
        type: "SHORT_VIDEO",
        title: `字幕: ${file.name}`,
        content: srt,
        inputData: { fileName: file.name, fileSize: file.size },
        metadata: { model: "whisper-1", format: "srt" },
        studioClientId,
        branchId: user.branchId,
        createdById: user.id,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: "studio_subtitle_generated",
      email: user.email,
      name: user.name,
      entity: "production",
      detail: `字幕生成: ${file.name}（${(file.size / 1024 / 1024).toFixed(1)}MB）`,
    },
  });

  return NextResponse.json({ srt, fileName: file.name });
}
