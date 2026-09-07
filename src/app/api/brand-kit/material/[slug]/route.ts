import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildOnePackageMaterial } from "@/lib/brand-kit/materials";
import { trackBrandKit } from "@/lib/brand-kit/track";

// パッケージ1件のAI用材料を .md として返す（ログイン必須）
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  const body = await buildOnePackageMaterial(session.user.email, slug);
  if (!body) return NextResponse.json({ error: "Not found" }, { status: 404 });
  trackBrandKit({ event: "download", kind: "material", items: [slug], email: session.user.email, name: session.user.name ?? null, req });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`AI用材料_${slug}_${date}.md`)}`,
      "Cache-Control": "no-store",
    },
  });
}
