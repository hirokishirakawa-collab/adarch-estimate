import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReviewFrameUrl } from "@/lib/storage";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const url = await getReviewFrameUrl(path);
  if (!url) {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }

  return NextResponse.json({ url });
}
