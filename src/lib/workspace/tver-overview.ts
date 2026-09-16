import { db } from "@/lib/db";
import { getBranchFilter } from "@/lib/session";
import type { UserRole } from "@/types/roles";
import type { Prisma } from "@/generated/prisma/client";
import { libraryDateRange } from "./library-search";

export const TVER_STATUS: Record<string, string> = {
  PENDING: "審査待ち",
  SUBMITTED: "申請済み",
  APPROVED: "承認済み",
  REJECTED: "否決",
  DRAFT: "下書き",
};
export async function tverOverview(
  viewer: { role: UserRole; branchId: string | null; branchId2: string | null },
  input: {
    q?: string;
    from?: string;
    to?: string;
    sort?: string;
    page?: string;
  },
) {
  const scope = getBranchFilter(viewer);
  const where: Prisma.AdvertiserReviewWhereInput = {
    ...scope,
    name: {
      contains: (input.q ?? "").trim().slice(0, 120),
      mode: "insensitive",
    },
    updatedAt: libraryDateRange(input.from, input.to),
  };
  const count = await db.advertiserReview.count({ where });
  const pages = Math.max(1, Math.ceil(count / 20));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(input.page ?? "1", 10) || 1),
  );
  const advertisers = await db.advertiserReview.findMany({
    where,
    orderBy:
      input.sort === "name"
        ? { name: "asc" }
        : { updatedAt: input.sort === "oldest" ? "asc" : "desc" },
    skip: (page - 1) * 20,
    take: 20,
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
      branch: { select: { name: true } },
      tverCampaigns: {
        where: scope,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          campaignName: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      },
      tverCreativeReviews: {
        where: scope,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, projectName: true, status: true },
      },
      _count: {
        select: {
          tverCampaigns: { where: scope },
          tverCreativeReviews: { where: scope },
        },
      },
    },
  });
  return { advertisers, count, page, pages };
}
