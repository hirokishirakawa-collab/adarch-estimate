import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);

  const cards = await db.businessCard.findMany({
    where: {
      ownerId: user.id,
      ...(q
        ? {
            OR: [
              { companyName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      companyName: true,
      department: true,
      title: true,
      lastName: true,
      firstName: true,
      prefecture: true,
      companyPhone: true,
      url: true,
      wantsCollab: true,
      isOrdered: true,
      isCompetitor: true,
      aiIndustry: true,
      createdAt: true,
    },
  });

  return NextResponse.json(cards);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  try {
    const data = await request.json();

    const card = await db.businessCard.create({
      data: {
        companyName: data.companyName || "不明",
        lastName: data.lastName || "不明",
        firstName: data.firstName || null,
        department: data.department || null,
        title: data.title || null,
        email: data.email || null,
        companyPhone: data.companyPhone || null,
        directPhone: data.directPhone || null,
        mobilePhone: data.mobilePhone || null,
        fax: data.fax || null,
        postalCode: data.postalCode || null,
        address: data.address || null,
        url: data.url || null,
        prefecture: data.prefecture || null,
        ownerId: user.id,
      },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (e) {
    console.error("[Mobile BusinessCard] Error:", e);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
