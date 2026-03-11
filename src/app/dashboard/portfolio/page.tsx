import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortfolioExplorer } from "@/components/portfolio/portfolio-explorer";

export const metadata = { title: "実績フォルダ検索 | Ad-Arch" };

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; depth?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const typeFilter = params.type || "all";
  const depthFilter = params.depth ? parseInt(params.depth, 10) : null;

  // 検索クエリ構築
  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { path: { contains: q, mode: "insensitive" } },
    ];
  }
  if (typeFilter === "folder") where.itemType = "folder";
  if (typeFilter === "file") where.itemType = "file";
  if (depthFilter !== null) where.depth = depthFilter;

  const [items, totalCount, lastSync] = await Promise.all([
    db.portfolioItem.findMany({
      where,
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      take: 200,
    }),
    db.portfolioItem.count({ where }),
    db.portfolioItem.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
  ]);

  // サマリー用の集計
  const summary = await db.portfolioItem.groupBy({
    by: ["itemType"],
    _count: { id: true },
  });
  const folderCount = summary.find((s) => s.itemType === "folder")?._count.id ?? 0;
  const fileCount = summary.find((s) => s.itemType === "file")?._count.id ?? 0;

  // トップレベルフォルダ（depth=1 = クライアント/案件）
  const topFolders = await db.portfolioItem.findMany({
    where: { itemType: "folder", depth: 1 },
    orderBy: { name: "asc" },
    select: { name: true, driveUrl: true },
  });

  return (
    <PortfolioExplorer
      items={items.map((item) => ({
        id: item.id,
        name: item.name,
        path: item.path,
        itemType: item.itemType,
        mimeType: item.mimeType,
        depth: item.depth,
        sizeMb: item.sizeMb,
        driveUrl: item.driveUrl,
        parentName: item.parentName,
        lastUpdated: item.lastUpdated.toISOString(),
      }))}
      totalCount={totalCount}
      folderCount={folderCount}
      fileCount={fileCount}
      topFolders={topFolders}
      lastSyncedAt={lastSync?.syncedAt?.toISOString() ?? null}
      query={q}
      typeFilter={typeFilter}
    />
  );
}
