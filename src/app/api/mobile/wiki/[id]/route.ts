import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../../_lib/verify-mobile-token";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const article = await db.wikiArticle.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        body: true,
        authorName: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: article.id,
      title: article.title,
      body: article.body,
      category: null as string | null,
      authorName: article.authorName,
      branchId: article.branchId,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    });
  } catch (e) {
    console.error("[GET /api/mobile/wiki/[id]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
