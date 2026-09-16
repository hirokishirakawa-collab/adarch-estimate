import { db } from "@/lib/db";
import { knowledgeWhere } from "@/lib/knowledge/search";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";
import { wikiGuidance } from "./wiki-guidance";

export interface LibraryHit {
  id: string;
  title: string;
  href: string;
  kind: "material" | "wiki" | "package" | "case" | "portfolio" | "seminar";
  source: string;
  excerpt: string;
  updatedAt: string;
}
export interface LibraryQuery {
  q?: string;
  kind?: string;
  from?: string;
  to?: string;
  sort?: string;
  limit?: number;
}
export function libraryDateRange(from?: string, to?: string) {
  const parse = (s?: string, end = false) =>
    s &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
      ? new Date(`${s}T${end ? "23:59:59.999" : "00:00:00"}+09:00`)
      : undefined;
  return { gte: parse(from), lte: parse(to, true) };
}
export async function searchWorkspaceLibrary(
  viewer: { role: UserRole; email: string },
  input: LibraryQuery,
): Promise<LibraryHit[]> {
  const q = (input.q ?? "").trim().slice(0, 120);
  const take = Math.min(30, Math.max(1, input.limit ?? 20));
  const isAdmin = viewer.role === "ADMIN";
  const branch = getMockBranchId(viewer.email, viewer.role);
  const updatedAt = libraryDateRange(input.from, input.to);
  const orderBy =
    input.sort === "name"
      ? { title: "asc" as const }
      : {
          updatedAt:
            input.sort === "oldest" ? ("asc" as const) : ("desc" as const),
        };
  const [materials, wiki, packages, cases, portfolio, seminars] =
    await Promise.all([
      !input.kind || input.kind === "all" || input.kind === "material"
        ? db.knowledgeSource.findMany({
            where: {
              ...knowledgeWhere({ isAdmin }),
              updatedAt,
              ...(q
                ? {
                    OR: [
                      { title: { contains: q, mode: "insensitive" as const } },
                      {
                        summary: { contains: q, mode: "insensitive" as const },
                      },
                      {
                        content: { contains: q, mode: "insensitive" as const },
                      },
                      {
                        publisher: {
                          contains: q,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              title: true,
              summary: true,
              origin: true,
              publisher: true,
              updatedAt: true,
            },
            orderBy,
            take,
          })
        : [],
      !input.kind || input.kind === "all" || input.kind === "wiki"
        ? db.wikiArticle.findMany({
            where: {
              ...(!isAdmin && branch
                ? { branchId: { in: [branch, "branch_hq"] } }
                : {}),
              ...(!isAdmin
                ? {
                    NOT: {
                      OR: [
                        { title: { contains: "ADMIN向け" } },
                        { title: { contains: "ADMIN専用" } },
                        { title: { contains: "本部のみ" } },
                      ],
                    },
                  }
                : {}),
              updatedAt,
              ...(q
                ? {
                    OR: [
                      { title: { contains: q, mode: "insensitive" as const } },
                      { body: { contains: q, mode: "insensitive" as const } },
                    ],
                  }
                : {}),
            },
            select: { id: true, title: true, body: true, updatedAt: true },
            orderBy,
            take,
          })
        : [],
      !input.kind || input.kind === "all" || input.kind === "package"
        ? db.salesPackage.findMany({
            where: {
              status: { in: ["ACTIVE", "PROPOSED"] },
              updatedAt,
              ...(q
                ? {
                    OR: [
                      { name: { contains: q, mode: "insensitive" as const } },
                      {
                        tagline: { contains: q, mode: "insensitive" as const },
                      },
                      {
                        category: { contains: q, mode: "insensitive" as const },
                      },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              name: true,
              slug: true,
              tagline: true,
              status: true,
              updatedAt: true,
            },
            orderBy:
              input.sort === "name"
                ? { name: "asc" }
                : { updatedAt: input.sort === "oldest" ? "asc" : "desc" },
            take,
          })
        : [],
      !input.kind || input.kind === "all" || input.kind === "case"
        ? db.salesApproach.findMany({
            where: {
              createdAt: updatedAt,
              ...(q
                ? {
                    OR: [
                      {
                        industry: { contains: q, mode: "insensitive" as const },
                      },
                      {
                        targetDesc: {
                          contains: q,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        learnings: {
                          contains: q,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        messageBody: {
                          contains: q,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              industry: true,
              targetDesc: true,
              learnings: true,
              createdAt: true,
            },
            orderBy:
              input.sort === "name"
                ? { industry: "asc" }
                : { createdAt: input.sort === "oldest" ? "asc" : "desc" },
            take,
          })
        : [],
      !input.kind || input.kind === "all" || input.kind === "portfolio"
        ? db.portfolioItem.findMany({
            where: {
              lastUpdated: updatedAt,
              ...(q
                ? {
                    OR: [
                      { name: { contains: q, mode: "insensitive" as const } },
                      { path: { contains: q, mode: "insensitive" as const } },
                    ],
                  }
                : {}),
            },
            select: { id: true, name: true, path: true, lastUpdated: true },
            orderBy:
              input.sort === "name"
                ? { name: "asc" }
                : { lastUpdated: input.sort === "oldest" ? "asc" : "desc" },
            take,
          })
        : [],
      !input.kind || input.kind === "all" || input.kind === "seminar"
        ? db.seminarRecording.findMany({
            where: {
              isActive: true,
              updatedAt,
              ...(q
                ? {
                    OR: [
                      { title: { contains: q, mode: "insensitive" as const } },
                      {
                        summary: { contains: q, mode: "insensitive" as const },
                      },
                      {
                        audience: { contains: q, mode: "insensitive" as const },
                      },
                      {
                        presenterName: {
                          contains: q,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              title: true,
              summary: true,
              presenterName: true,
              updatedAt: true,
            },
            orderBy,
            take,
          })
        : [],
    ]);
  const rows: LibraryHit[] = [
    ...materials.map((m) => ({
      id: m.id,
      title: m.title,
      href: `/dashboard/knowledge/${m.id}`,
      kind: "material" as const,
      source: m.origin === "OWN" ? "自社資料" : "他社・媒体資料（仕様の参考）",
      excerpt: (m.summary ?? m.publisher ?? "").slice(0, 180),
      updatedAt: m.updatedAt.toISOString(),
    })),
    ...wiki.map((w) => ({
      id: w.id,
      title: w.title,
      href: `/dashboard/wiki/${w.id}`,
      kind: "wiki" as const,
      source: wikiGuidance(w.title, w.body)
        ? "手順・旧仕様を含む"
        : "手順・Wiki",
      excerpt:
        wikiGuidance(w.title, w.body)?.notice ??
        w.body.replace(/[#*`]/g, "").replace(/\s+/g, " ").slice(0, 150),
      updatedAt: w.updatedAt.toISOString(),
    })),
    ...packages.map((p) => ({
      id: p.id,
      title: p.name,
      href: `/dashboard/packages/${p.slug}`,
      kind: "package" as const,
      source: p.status === "ACTIVE" ? "商品・媒体" : "商品・提案中",
      excerpt: p.tagline ?? "",
      updatedAt: p.updatedAt.toISOString(),
    })),
    ...cases.map((c) => ({
      id: c.id,
      title: `${c.industry}の営業事例`,
      href: `/dashboard/sales-approaches?id=${c.id}`,
      kind: "case" as const,
      source: "グループの営業事例",
      excerpt: (c.learnings ?? c.targetDesc ?? "").slice(0, 180),
      updatedAt: c.createdAt.toISOString(),
    })),
    ...portfolio.map((p) => ({
      id: p.id,
      title: p.name,
      href: `/dashboard/portfolio?q=${encodeURIComponent(p.name)}`,
      kind: "portfolio" as const,
      source: "グループ実績・素材",
      excerpt: p.path,
      updatedAt: p.lastUpdated.toISOString(),
    })),
    ...seminars.map((s) => ({
      id: s.id,
      title: s.title,
      href: `/dashboard/seminars#recording-${s.id}`,
      kind: "seminar" as const,
      source: `セミナー録画 · ${s.presenterName}`,
      excerpt: (s.summary ?? "").slice(0, 180),
      updatedAt: s.updatedAt.toISOString(),
    })),
  ];
  return rows.sort((a, b) =>
    input.sort === "name"
      ? a.title.localeCompare(b.title, "ja")
      : input.sort === "oldest"
        ? a.updatedAt.localeCompare(b.updatedAt)
        : b.updatedAt.localeCompare(a.updatedAt),
  );
}
