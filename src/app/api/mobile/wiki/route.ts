import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../_lib/verify-mobile-token";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const categoryParam = searchParams.get("category");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 50;

  try {
    // WikiArticle has no category field in the schema; filter by title prefix convention
    // if a ?category= param is passed, we do a case-insensitive title/body search
    const where = categoryParam
      ? {
          OR: [
            { title: { contains: categoryParam, mode: "insensitive" as const } },
          ],
        }
      : {};

    const articles = await db.wikiArticle.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        authorName: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const result = articles.map((a) => ({
      id: a.id,
      title: a.title,
      category: null as string | null,
      authorName: a.authorName,
      branchId: a.branchId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/mobile/wiki]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
