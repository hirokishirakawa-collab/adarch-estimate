import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { Target, Plus, Link2 } from "lucide-react";
import { AchievementTracker } from "@/components/video-achievements/achievement-tracker";
import type { UserRole } from "@/types/roles";
import type { Prisma } from "@/generated/prisma/client";

interface PageProps {
  searchParams: Promise<{
    prefecture?: string;
    industry?: string;
    productionCompany?: string;
    isProcessed?: string;
  }>;
}

export default async function VideoAchievementsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const session = await auth();
  const role    = (session?.user?.role ?? "MANAGER") as UserRole;

  const where: Prisma.VideoAchievementWhereInput = {};
  if (params.prefecture)        where.prefecture        = params.prefecture;
  if (params.industry)          where.industry          = params.industry;
  if (params.productionCompany) where.productionCompany = { contains: params.productionCompany, mode: "insensitive" };
  if (params.isProcessed === "true")  where.isProcessed = true;
  if (params.isProcessed === "false") where.isProcessed = false;

  const achievements = await db.videoAchievement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id:                true,
      companyName:       true,
      prefecture:        true,
      industry:          true,
      videoType:         true,
      productionCompany: true,
      referenceUrl:      true,
      contentSummary:    true,
      publishedAt:       true,
      isProcessed:       true,
      createdAt:         true,
    },
  });

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Target className="text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">動画実績DB（自動収集）</h2>
            <p className="text-xs text-zinc-500 mt-0.5">競合制作会社の実績から攻略ターゲットを発見する</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/video-achievements/scrape"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            URLから取込
          </Link>
          <Link
            href="/dashboard/video-achievements/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            手動登録
          </Link>
        </div>
      </div>

      <AchievementTracker achievements={achievements} role={role} />
    </div>
  );
}
