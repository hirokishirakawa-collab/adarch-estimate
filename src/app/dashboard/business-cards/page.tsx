import { Suspense } from "react";
import Link from "next/link";
import { ContactRound, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { CardSearch } from "@/components/business-cards/card-search";
import { CardTable } from "@/components/business-cards/card-table";
import { ITEMS_PER_PAGE } from "@/lib/constants/business-cards";
import type { RegionValue } from "@/lib/constants/business-cards";

export default async function BusinessCardsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionInfo = await getSessionInfo();
  if (!sessionInfo) redirect("/login");

  const searchParams = await props.searchParams;

  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const industry = typeof searchParams.industry === "string" ? searchParams.industry : "";
  const region = typeof searchParams.region === "string" ? searchParams.region : "";
  const collab = typeof searchParams.collab === "string" ? searchParams.collab : "";
  const competitor = typeof searchParams.competitor === "string" ? searchParams.competitor : "";
  const page = Math.max(1, Number(searchParams.page) || 1);

  // WHERE 条件構築
  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { companyName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
    ];
  }
  if (industry) {
    where.aiIndustry = industry;
  }
  if (region) {
    where[region as RegionValue] = true;
  }
  if (collab === "1") where.wantsCollab = true;
  if (collab === "0") where.wantsCollab = false;
  if (competitor === "1") where.isCompetitor = true;
  if (competitor === "0") where.isCompetitor = false;

  const [cards, total] = await Promise.all([
    db.businessCard.findMany({
      where,
      select: {
        id: true,
        companyName: true,
        department: true,
        title: true,
        lastName: true,
        firstName: true,
        prefecture: true,
        aiIndustry: true,
        wantsCollab: true,
        isOrdered: true,
        isCompetitor: true,
        isCreator: true,
        exchangeDate: true,
        regionHokkaido: true,
        regionTohoku: true,
        regionKitakanto: true,
        regionSaitama: true,
        regionChiba: true,
        regionTokyo: true,
        regionKanagawa: true,
        regionChubu: true,
        regionKansai: true,
        regionChugoku: true,
        regionShikoku: true,
        regionKyushu: true,
        owner: { select: { name: true } },
      },
      orderBy: { companyName: "asc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    db.businessCard.count({ where }),
  ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // サマリー統計
  const [totalCards, collabCount, competitorCount, orderedCount] =
    await Promise.all([
      db.businessCard.count(),
      db.businessCard.count({ where: { wantsCollab: true } }),
      db.businessCard.count({ where: { isCompetitor: true } }),
      db.businessCard.count({ where: { isOrdered: true } }),
    ]);

  // baseUrl をクエリパラメータ付きで構築（page 以外）
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (industry) params.set("industry", industry);
  if (region) params.set("region", region);
  if (collab) params.set("collab", collab);
  if (competitor) params.set("competitor", competitor);
  const baseUrl = `/dashboard/business-cards?${params.toString()}`;

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center">
            <ContactRound style={{ width: "1.125rem", height: "1.125rem" }} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">名刺管理</h1>
            <p className="text-xs text-zinc-500">
              Eight エクスポートデータの一元管理・検索・マッチング
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/business-cards/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規登録
        </Link>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "全名刺数", value: totalCards },
          { label: "コラボ希望", value: collabCount },
          { label: "受注済み", value: orderedCount },
          { label: "競合", value: competitorCount },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-zinc-200 px-4 py-3"
          >
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
              {stat.label}
            </p>
            <p className="text-xl font-bold text-zinc-900 mt-0.5">
              {stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* 検索・フィルタ */}
      <Suspense fallback={null}>
        <CardSearch />
      </Suspense>

      {/* テーブル */}
      <CardTable
        cards={cards}
        page={page}
        totalPages={totalPages}
        total={total}
        baseUrl={baseUrl}
        isAdmin={sessionInfo.role === "ADMIN"}
      />
    </div>
  );
}
