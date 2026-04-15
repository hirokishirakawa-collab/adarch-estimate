import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../_lib/verify-mobile-token";
import { resolveDbUser, buildBranchFilter } from "../_lib/authorize";

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
    // Branch-scope for non-ADMIN
    let branchFilter: Record<string, unknown> = {};
    if (user.role !== "ADMIN") {
      const dbUser = await resolveDbUser(user.email);
      const filter = buildBranchFilter(user.role, dbUser?.branchId ?? null, dbUser?.branchId2 ?? null);
      if (!filter) {
        return NextResponse.json({ error: "Branch not assigned" }, { status: 403 });
      }
      branchFilter = filter;
    }

    const where = {
      ...branchFilter,
      ...(categoryParam
        ? {
            OR: [
              { title: { contains: categoryParam, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

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
