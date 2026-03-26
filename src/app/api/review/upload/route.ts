import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const STORAGE_ROOT = process.env.STORAGE_PATH || "/data/storage";
const BUCKET = "video-reviews";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const prefix = (formData.get("prefix") as string) || "";

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() ?? "mp4";
    const fileName = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const dir = path.join(STORAGE_ROOT, BUCKET);

    if (prefix) {
      const subDir = path.join(dir, path.dirname(prefix));
      if (!existsSync(subDir)) mkdirSync(subDir, { recursive: true });
    }
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const buf = Buffer.from(await file.arrayBuffer());
    writeFileSync(path.join(dir, fileName), buf);

    return NextResponse.json({
      path: fileName,
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

// Disable body parser limit for this route
export const config = {
  api: {
    bodyParser: false,
  },
};
