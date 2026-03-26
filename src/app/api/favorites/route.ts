import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const favorites = await db.userFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  return NextResponse.json(favorites);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const { path, label, icon } = body as { path: string; label: string; icon?: string };

  if (!path || !label) {
    return NextResponse.json({ error: "path and label are required" }, { status: 400 });
  }

  // Check limit (max 5)
  const count = await db.userFavorite.count({ where: { userId: user.id } });
  if (count >= 5) {
    return NextResponse.json({ error: "Maximum 5 favorites allowed" }, { status: 400 });
  }

  const favorite = await db.userFavorite.upsert({
    where: { userId_path: { userId: user.id, path } },
    create: { userId: user.id, path, label, icon: icon ?? null },
    update: { label, icon: icon ?? null },
  });

  return NextResponse.json(favorite);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path query param is required" }, { status: 400 });
  }

  await db.userFavorite.deleteMany({
    where: { userId: user.id, path },
  });

  return NextResponse.json({ ok: true });
}
