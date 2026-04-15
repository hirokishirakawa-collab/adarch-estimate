import { db } from "@/lib/db";

/** DB fields commonly needed for mobile authorization. */
export async function resolveDbUser(email: string) {
  return db.user.findUnique({
    where: { email },
    select: {
      id: true,
      branchId: true,
      branchId2: true,
      groupCompanyId: true,
    },
  });
}

/**
 * Branch-scoped Prisma `where` clause.
 * ADMIN → `{}` (no restriction).
 * Others → `{ branchId: { in: [branchId, branchId2] } }`.
 * Returns `null` when non-ADMIN has no branch (caller should 403).
 */
export function buildBranchFilter(
  role: string,
  branchId: string | null,
  branchId2: string | null
): Record<string, unknown> | null {
  if (role === "ADMIN") return {};
  if (!branchId) return null;
  const ids = [branchId, branchId2].filter(Boolean) as string[];
  return { branchId: { in: ids } };
}

/**
 * Whether the user may see financial amounts on this record.
 * true for ADMIN, or when the user is the record creator.
 */
export function canViewAmount(
  role: string,
  currentUserId: string,
  creatorUserId?: string | null
): boolean {
  if (role === "ADMIN") return true;
  if (creatorUserId && currentUserId === creatorUserId) return true;
  return false;
}
