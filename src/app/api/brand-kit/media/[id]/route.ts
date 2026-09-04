import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildOneMediumMaterial } from "@/lib/brand-kit/materials";

// 媒体メニュー1件のAI用材料を .md として返す（ログイン必須）
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await buildOneMediumMaterial(session.user.email, id);
  if (!body) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`AI用材料_${id}_${date}.md`)}`,
      "Cache-Control": "no-store",
    },
  });
}
