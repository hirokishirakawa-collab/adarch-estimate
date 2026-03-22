import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user?.branchId) {
    return NextResponse.json({ error: "User not found or no branch" }, { status: 403 });
  }

  const body = await req.json();
  const {
    formatId,
    formatName,
    telopId,
    industry,
    taste,
    duration,
    platforms,
    structure,
    studioClientId,
  } = body;

  if (!formatId || !formatName) {
    return NextResponse.json({ error: "formatId and formatName are required" }, { status: 400 });
  }

  const order = await prisma.snsFormatOrder.create({
    data: {
      formatId,
      formatName,
      telopId: telopId || null,
      industry: industry || "",
      taste: taste || "",
      duration: duration || "",
      platforms: platforms || "",
      structure: structure || [],
      studioClientId: studioClientId || null,
      branchId: user.branchId,
      createdById: user.id,
      status: "PENDING",
    },
  });

  return NextResponse.json({ id: order.id, status: order.status });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user?.branchId) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  const isAdmin = user.role === "ADMIN";

  const orders = await prisma.snsFormatOrder.findMany({
    where: isAdmin ? {} : { branchId: user.branchId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      studioClient: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json(orders);
}
