import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { EditProjectForm } from "@/components/projects/edit-project-form";
import type { UserRole } from "@/types/roles";
import { ChevronLeft, FolderKanban } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const whereClause =
    role === "ADMIN" || !userBranchId ? { id } : { id, branchId: userBranchId };

  const [project, customers] = await Promise.all([
    db.project.findFirst({
      where: whereClause,
      include: { customer: { select: { id: true, name: true } } },
    }),
    db.customer.findMany({
      where: role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!project) notFound();

  return (
    <div className="px-6 py-6 space-y-4 max-w-3xl mx-auto w-full">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/projects" className="hover:text-zinc-800 transition-colors">
          プロジェクト管理
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/projects/${id}`}
          className="hover:text-zinc-800 transition-colors truncate max-w-xs"
        >
          {project.title}
        </Link>
        <span>/</span>
        <span className="text-zinc-400">編集</span>
      </div>

      {/* ページタイトル */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
          <FolderKanban className="text-violet-600" style={{ width: "1rem", height: "1rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">プロジェクトを編集</h2>
          <p className="text-xs text-zinc-500 mt-0.5">変更した項目は自動的にログに記録されます</p>
        </div>
      </div>

      <Link
        href={`/dashboard/projects/${id}`}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        詳細に戻る
      </Link>

      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-6">
        <EditProjectForm project={project} customers={customers} />
      </div>
    </div>
  );
}
