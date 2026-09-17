import { auth } from "@/lib/auth";
import { searchWorkspaceLibrary } from "@/lib/workspace/library-search";
import { db } from "@/lib/db";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";
import { getSessionInfo, ownBranchWhere } from "@/lib/session";
import type { UserRole } from "@/types/roles";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.isActive === false && session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

  const role = (session.user.role ?? "MANAGER") as UserRole;
  const email = session.user.email ?? "";
  // 拠点はDBの所属で判定（本部＝全部・代表＝自拠点だけ・所属なし＝何も出さない）
  const info = await getSessionInfo();

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().slice(0, 120) ?? "";

  if (!q || q.length < 2) {
    return Response.json({ customers: [], projects: [], deals: [], library: [] });
  }

  const branchFilter = info ? ownBranchWhere(info) : { branchId: "__unassigned__" };

  try {
    const [customers, projects, deals, library] = await Promise.all([
      db.customer.findMany({
        where: {
          ...branchFilter,
          // 実績アーカイブ（未整備）は通常の顧客検索に出さない
          NOT: { branchId: ARCHIVE_BRANCH_ID },
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
      searchWorkspaceLibrary({role, email}, {q, limit: 5}),
    ]);

    return Response.json({ customers, projects, deals, library });
  } catch (e) {
    console.error("[GET /api/search]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
