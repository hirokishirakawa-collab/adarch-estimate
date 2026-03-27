import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToDrive } from "@/lib/google-drive";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const prefix = (formData.get("prefix") as string) || "videos";

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const fileId = await uploadToDrive(buf, file.name, file.type || "video/mp4", prefix);

    return NextResponse.json({
      path: fileId,
      originalName: file.name,
      size: file.size,
    });
  } catch (e) {
    console.error("[upload] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
