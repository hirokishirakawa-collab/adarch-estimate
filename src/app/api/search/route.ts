import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user.role ?? "MANAGER") as UserRole;
  const email = session.user.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 2) {
    return Response.json({ customers: [], projects: [], deals: [] });
  }

  const branchFilter = userBranchId ? { branchId: userBranchId } : {};

  const [customers, projects, deals] = await Promise.all([
    db.customer.findMany({
      where: {
        ...branchFilter,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { nameKana: { contains: q, mode: "insensitive" } },
          { contactName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, nameKana: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    db.project.findMany({
      where: {
        ...branchFilter,
        title: { contains: q, mode: "insensitive" },
      },
      select: { id: true, title: true, status: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    db.deal.findMany({
      where: {
        ...branchFilter,
        title: { contains: q, mode: "insensitive" },
      },
      select: { id: true, title: true, status: true, customerId: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return Response.json({ customers, projects, deals });
}
