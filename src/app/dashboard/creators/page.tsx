import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Paintbrush, MapPin, ExternalLink } from "lucide-react";
import Link from "next/link";
import { CreatorFilters } from "./creator-filters";
import { FavoriteButton } from "./favorite-button";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    prefecture?: string;
    skill?: string;
    sort?: string;
    page?: string;
    fee?: string;
    fav?: string;
  }>;
}

const PER_PAGE = 20;

export default async function CreatorsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const prefectureFilter = params.prefecture || "";
  const skillFilter = params.skill || "";
  const sortParam = params.sort || "newest";
  const feeFilter = params.fee || "";
  const favOnly = params.fav === "1";
  const currentPage = parseInt(params.page || "1");
  const skip = (currentPage - 1) * PER_PAGE;

  // お気に入り取得
  const session = await auth();
  const userId = session?.user?.id;
  const favorites = userId
    ? await db.creatorFavorite.findMany({
        where: { userId },
        select: { creatorId: true },
      })
    : [];
  const favoriteIds = new Set(favorites.map((f) => f.creatorId));

  // WHERE句構築
  const where: Record<string, unknown> = {
    status: "ACTIVE",
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { nameKana: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { bio: { contains: q, mode: "insensitive" } },
      { equipment: { contains: q, mode: "insensitive" } },
      { prefecture: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { skills: { some: { category: { name: { contains: q, mode: "insensitive" } } } } },
      { skills: { some: { note: { contains: q, mode: "insensitive" } } } },
    ];
  }

  if (prefectureFilter) {
    where.prefecture = prefectureFilter;
  }

  if (skillFilter) {
    where.skills = { some: { categoryId: skillFilter } };
  }

  // 単価帯フィルタ
  if (feeFilter === "~20000") {
    where.dayRate = { lte: 20000 };
  } else if (feeFilter === "20000~40000") {
    where.dayRate = { gte: 20000, lte: 40000 };
  } else if (feeFilter === "40000~60000") {
    where.dayRate = { gte: 40000, lte: 60000 };
  } else if (feeFilter === "60000~") {
    where.dayRate = { gte: 60000 };
  }

  // お気に入りのみフィルタ
  if (favOnly && favoriteIds.size > 0) {
    where.id = { in: Array.from(favoriteIds) };
  } else if (favOnly && favoriteIds.size === 0) {
    where.id = { in: [] };
  }

  // ソート
  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (sortParam === "name") orderBy = { name: "asc" };
  if (sortParam === "rate_asc") orderBy = { dayRate: "asc" };
  if (sortParam === "rate_desc") orderBy = { dayRate: "desc" };
  if (sortParam === "exp_desc") orderBy = { yearsOfExp: "desc" };

  const [creators, total, skillCategories, prefectureCounts] =
    await Promise.all([
      db.creator.findMany({
        where,
        orderBy,
        skip,
        take: PER_PAGE,
        include: {
          skills: { include: { category: true } },
          _count: { select: { portfolios: true, ratings: true } },
        },
      }),
      db.creator.count({ where }),
      db.skillCategory.findMany({ orderBy: { order: "asc" } }),
      db.creator.groupBy({
        by: ["prefecture"],
        where: { status: "ACTIVE" },
        _count: true,
        orderBy: { _count: { prefecture: "desc" } },
      }),
    ]);

  const totalAll = await db.creator.count({ where: { status: "ACTIVE" } });
  const totalPages = Math.ceil(total / PER_PAGE);

  // ページネーション用のパラメータ構築
  const paginationParams = {
    ...(q && { q }),
    ...(prefectureFilter && { prefecture: prefectureFilter }),
    ...(skillFilter && { skill: skillFilter }),
    ...(feeFilter && { fee: feeFilter }),
    ...(sortParam !== "newest" && { sort: sortParam }),
    ...(favOnly && { fav: "1" }),
  };

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* クリエイター登録LP バナー */}
      <a
        href="https://creators.adarch.co.jp"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl px-5 py-3 mb-6 hover:from-indigo-700 hover:to-violet-700 transition-all shadow-sm"
      >
        <div>
          <p className="text-sm font-bold">
            クリエイター募集中
          </p>
          <p className="text-xs text-indigo-200 mt-0.5">
            creators.adarch.co.jp からクリエイター登録ができます
          </p>
        </div>
        <ExternalLink style={{ width: "1rem", height: "1rem" }} className="text-indigo-200 flex-shrink-0" />
      </a>

      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
          <Paintbrush
            className="text-indigo-600"
            style={{ width: "1.125rem", height: "1.125rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">クリエイター</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            登録クリエイターの検索・プロジェクト相談
          </p>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="登録クリエイター" count={totalAll} />
        <SummaryCard
          label="エリア数"
          count={prefectureCounts.length}
          sub="都道府県"
        />
        <SummaryCard label="検索結果" count={total} />
        <SummaryCard
          label="スキルカテゴリ"
          count={skillCategories.length}
          sub="種類"
        />
      </div>

      {/* フィルタ */}
      <CreatorFilters
        skillCategories={skillCategories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        prefectures={prefectureCounts.map((p) => ({
          name: p.prefecture,
          count: p._count,
        }))}
      />

      {/* 一覧 */}
      {creators.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm">
          該当するクリエイターが見つかりません
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {creators.map((c) => (
            <div
              key={c.id}
              className="relative bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              {/* お気に入りボタン（右上） */}
              <div className="absolute top-3 right-3 z-10">
                <FavoriteButton
                  creatorId={c.id}
                  isFavorite={favoriteIds.has(c.id)}
                />
              </div>

              <Link
                href={`/dashboard/creators/${c.id}`}
                className="block"
              >
                <div className="flex items-start gap-3 mb-3 pr-8">
                  {/* アバター */}
                  <div className="w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {c.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.profileImage} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-zinc-400 text-sm font-bold">{c.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-zinc-900 truncate">{c.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 shrink-0">
                        {c.entityType === "corporation" ? "法人" : "個人"}
                      </span>
                    </div>
                    {c.companyName && (
                      <p className="text-xs text-zinc-400 truncate">{c.companyName}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-3">
                  <MapPin style={{ width: "0.75rem", height: "0.75rem" }} />
                  <span>
                    {c.prefecture}
                    {c.city ? ` ${c.city}` : ""}
                  </span>
                  {c.yearsOfExp && (
                    <>
                      <span className="text-zinc-300 mx-1">|</span>
                      <span>経験{c.yearsOfExp}年</span>
                    </>
                  )}
                </div>

                {/* スキルタグ */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {c.skills.slice(0, 4).map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-medium"
                    >
                      {s.category.name}
                      <span className="text-indigo-400">
                        {s.level === "EXPERT"
                          ? "★"
                          : s.level === "ADVANCED"
                            ? "◆"
                            : s.level === "INTERMEDIATE"
                              ? "●"
                              : "○"}
                      </span>
                    </span>
                  ))}
                  {c.skills.length > 4 && (
                    <span className="text-[10px] text-zinc-400">
                      +{c.skills.length - 4}
                    </span>
                  )}
                </div>

                {/* 自己PR（先頭80文字） */}
                {c.bio && (
                  <p className="text-xs text-zinc-400 mb-3 line-clamp-2 leading-relaxed">
                    {c.bio}
                  </p>
                )}

                {/* 単価・稼働 */}
                <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                  {c.dayRate && (
                    <span>
                      日額{" "}
                      <span className="font-bold text-zinc-700">
                        ¥{c.dayRate.toLocaleString()}
                      </span>
                    </span>
                  )}
                  {c.availability && <span>月{c.availability}日稼働可</span>}
                  {c._count.portfolios > 0 && (
                    <span className="text-zinc-400">
                      実績{c._count.portfolios}件
                    </span>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/dashboard/creators?${new URLSearchParams({
                ...paginationParams,
                page: String(p),
              }).toString()}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                p === currentPage
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  count,
  sub,
}: {
  label: string;
  count: number;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
      <p className="text-[11px] text-zinc-500 font-semibold mb-0.5">{label}</p>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-bold text-zinc-900">{count}</p>
        {sub && <span className="text-xs text-zinc-400">{sub}</span>}
      </div>
    </div>
  );
}
