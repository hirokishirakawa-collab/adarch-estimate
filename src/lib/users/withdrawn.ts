import type { Prisma } from "@/generated/prisma/client";

// 脱退者（suspendReason = WITHDRAWN）を一覧から外す条件（2026-09-15）。
// suspendReason は NULL が普通なので、NULL を落とさないよう OR で書く
export const NOT_WITHDRAWN = {
  OR: [{ suspendReason: null }, { suspendReason: { not: "WITHDRAWN" } }],
} satisfies Prisma.UserWhereInput;
