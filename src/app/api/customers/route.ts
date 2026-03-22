import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const limit = parseInt(url.searchParams.get("limit") || "20");

  const isAdmin = user.role === "ADMIN";
  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  const customers = await prisma.customer.findMany({
    where: {
      ...branchFilter,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { industry: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    },
    select: {
      id: true,
      name: true,
      industry: true,
      prefecture: true,
      address: true,
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return NextResponse.json(customers);
}
