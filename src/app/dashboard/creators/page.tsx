import { db } from "@/lib/db";
import { Paintbrush, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { CreatorFilters } from "./creator-filters";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    prefecture?: string;
    skill?: string;
    sort?: string;
    page?: string;
  }>;
}

const PER_PAGE = 20;

export default async function CreatorsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const prefectureFilter = params.prefecture || "";
  const skillFilter = params.skill || "";
  const sortParam = params.sort || "newest";
  const currentPage = parseInt(params.page || "1");
  const skip = (currentPage - 1) * PER_PAGE;

  // WHERE句構築
  const where: Record<string, unknown> = {
    status: "ACTIVE",
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { bio: { contains: q, mode: "insensitive" } },
      { equipment: { contains: q, mode: "insensitive" } },
    ];
  }

  if (prefectureFilter) {
    where.prefecture = prefectureFilter;
  }

  if (skillFilter) {
    where.skills = { some: { categoryId: skillFilter } };
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

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
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
            <Link
              key={c.id}
              href={`/dashboard/creators/${c.id}`}
              className="block bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900">{c.name}</h3>
                  {c.companyName && (
                    <p className="text-xs text-zinc-400">{c.companyName}</p>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                  {c.entityType === "corporation" ? "法人" : "個人"}
                </span>
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

              {/* 単価・稼働 */}
              <div className="flex items-center gap-3 text-xs text-zinc-500">
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
                ...(q && { q }),
                ...(prefectureFilter && { prefecture: prefectureFilter }),
                ...(skillFilter && { skill: skillFilter }),
                ...(sortParam !== "newest" && { sort: sortParam }),
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
