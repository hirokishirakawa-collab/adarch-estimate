import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { savePackageImage } from "@/lib/storage";
import { generateHeroImage } from "@/lib/tver/hero-image";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_UPLOAD = 12 * 1024 * 1024;

// ---------------------------------------------------------------
// POST /api/packages/image
//   multipart: file=<画像>                    → アップロード（横1600pxに収める）
//   json:      { generate: true, name, tagline, category, painPoints, summary }
//                                             → gpt-image-1 で参考イメージを1枚（TVerチラシと同じ経路）
//   どちらも { url } を返す。保存はパッケージのフォームで imageUrl として送る
// ---------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file がありません" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "画像ファイルを選んでください" }, { status: 400 });
    if (file.size > MAX_UPLOAD) return NextResponse.json({ error: "12MB以下の画像にしてください" }, { status: 400 });
    const url = await savePackageImage(Buffer.from(await file.arrayBuffer()));
    if (!url) return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    return NextResponse.json({ url });
  }

  let body: { generate?: boolean; name?: string; tagline?: string; category?: string; painPoints?: string; summary?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.generate) return NextResponse.json({ error: "generate か file を指定してください" }, { status: 400 });
  const name = (body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "パッケージ名を先に入れてください" }, { status: 400 });

  const prompt = [
    "Photorealistic editorial photograph for a Japanese advertising-agency service brochure.",
    `Service: "${name}" (${(body.category ?? "").slice(0, 40)}). ${(body.tagline ?? "").slice(0, 120)}`,
    body.summary ? `What it delivers: ${body.summary.slice(0, 300)}` : "",
    body.painPoints ? `Customer situation: ${body.painPoints.slice(0, 200)}` : "",
    "Show the real-world scene where this service is used in a Japanese town (shop front, office, factory, or street), natural daylight, warm and clean, shallow depth of field, no text, no logos, no watermarks, no people's faces in close-up, landscape 3:2.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const img = await generateHeroImage(prompt);
    const url = await savePackageImage(img.data);
    if (!url) return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "生成に失敗しました";
    console.error("[packages/image] generate failed:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
