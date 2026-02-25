import { auth } from "@/lib/auth";
import Link from "next/link";
import { Plus, FolderKanban } from "lucide-react";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";
import type { ProjectStatus } from "@/generated/prisma/client";
import { ProjectTable } from "@/components/projects/project-table";
import { ProjectSearch } from "@/components/projects/project-search";
import { ProjectPagination } from "@/components/projects/project-pagination";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants/projects";
import { Suspense } from "react";

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    overdue?: string;
    page?: string;
  }>;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const { q = "", status = "", overdue = "", page = "1" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  // フィルタ
  const branchWhere = role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId };
  const textWhere   = q ? { title: { contains: q, mode: "insensitive" as const } } : {};
  const statusWhere = status ? { status: status as ProjectStatus } : {};
  const overdueWhere = overdue
    ? { deadline: { lt: new Date() }, status: { notIn: ["COMPLETED", "CANCELLED"] as ProjectStatus[] } }
    : {};
  const where = { ...branchWhere, ...textWhere, ...statusWhere, ...overdueWhere };

  const [projects, total, totalByStatus] = await Promise.all([
    db.project.findMany({
      where,
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.project.count({ where }),
    db.project.groupBy({
      by: ["status"],
      where: branchWhere, // サマリーカードはフィルタなしの全件
      _count: { status: true },
    }),
  ]);

  const totalPages  = Math.ceil(total / PAGE_SIZE);
  const statusCount = Object.fromEntries(
    totalByStatus.map((r) => [r.status, r._count.status])
  );
  const totalAll = totalByStatus.reduce((s, r) => s + r._count.status, 0);

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
            <FolderKanban
              className="text-violet-600"
              style={{ width: "1.125rem", height: "1.125rem" }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">プロジェクト管理</h2>
            <p className="text-xs text-zinc-500 mt-0.5">受注案件の進行状況を一元管理</p>
          </div>
        </div>
        <Link href="/dashboard/projects/new">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            新規プロジェクト
          </button>
        </Link>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">全件</p>
          <p className="text-xl font-bold text-zinc-900 mt-0.5">
            {totalAll.toLocaleString()}
          </p>
        </div>
        {PROJECT_STATUS_OPTIONS.map((opt) => (
          <div key={opt.value} className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
            <p className="text-[11px] text-zinc-500">
              {opt.icon} {opt.label}
            </p>
            <p className="text-xl font-bold text-zinc-900 mt-0.5">
              {statusCount[opt.value] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* 検索・フィルタ */}
      <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3">
        <Suspense fallback={null}>
          <ProjectSearch />
        </Suspense>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <ProjectTable projects={projects} isAdmin={role === "ADMIN"} />
        <div className="border-t border-zinc-100 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            全 {total.toLocaleString()} 件中{" "}
            {Math.min((currentPage - 1) * PAGE_SIZE + 1, total)}〜
            {Math.min(currentPage * PAGE_SIZE, total)} 件を表示
          </p>
          <Suspense fallback={null}>
            <ProjectPagination currentPage={currentPage} totalPages={totalPages} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
