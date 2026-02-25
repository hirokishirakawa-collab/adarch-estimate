import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants/projects";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/constants/expenses";
import { ProjectLogTimeline } from "@/components/projects/project-log-timeline";
import { ExpenseForm } from "@/components/projects/expense-form";
import { ExpenseList } from "@/components/projects/expense-list";
import { BillingStatusButton } from "@/components/projects/billing-status-button";
import type { UserRole } from "@/types/roles";
import {
  ChevronLeft,
  FolderKanban,
  Pencil,
  Calendar,
  User,
  Building2,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}


export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const whereClause =
    role === "ADMIN" || !userBranchId ? { id } : { id, branchId: userBranchId };

  const project = await db.project.findFirst({
    where: whereClause,
    include: {
      customer: { select: { id: true, name: true } },
      branch:   { select: { name: true } },
      expenses: { orderBy: { date: "desc" } },
      logs:     { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) notFound();

  // ステータス設定
  const statusOpt = PROJECT_STATUS_OPTIONS.find((o) => o.value === project.status);

  // 経費合計
  const totalExpense = project.expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // 日付フォーマット
  const fmt = (d: Date | null | undefined) =>
    d
      ? new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(new Date(d))
      : "—";

  const today = new Date();
  const isOverdue =
    project.deadline &&
    new Date(project.deadline) < today &&
    project.status !== "COMPLETED" &&
    project.status !== "CANCELLED";

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-xl mx-auto w-full">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/projects" className="hover:text-zinc-800 transition-colors">
          プロジェクト管理
        </Link>
        <span>/</span>
        <span className="text-zinc-400 truncate max-w-xs">{project.title}</span>
      </div>

      {/* ヘッダーカード */}
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FolderKanban className="text-violet-600 w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {statusOpt && (
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${statusOpt.className}`}>
                    {statusOpt.icon} {statusOpt.label}
                  </span>
                )}
                {isOverdue && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-600 border border-red-200">
                    期限超過
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-zinc-900">{project.title}</h1>
              {project.description && (
                <p className="text-sm text-zinc-500 mt-1 whitespace-pre-wrap">{project.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <BillingStatusButton projectId={project.id} billingStatus={project.billingStatus} />
            <Link
              href={`/dashboard/projects/${project.id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              編集
            </Link>
          </div>
        </div>

        {/* 基本情報グリッド */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-zinc-100">
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> 納期
            </p>
            <p className={`text-sm font-semibold ${isOverdue ? "text-red-600" : "text-zinc-700"}`}>
              {fmt(project.deadline)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <User className="w-3 h-3" /> 担当者
            </p>
            <p className="text-sm font-semibold text-zinc-700">{project.staffName ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> 拠点
            </p>
            <p className="text-sm font-semibold text-zinc-700">{project.branch.name}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">顧客</p>
            {project.customer ? (
              <Link
                href={`/dashboard/customers/${project.customer.id}`}
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                {project.customer.name}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-zinc-400">—</p>
            )}
          </div>
        </div>
      </div>

      {/* 経費合計カード */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 w-full sm:w-64">
        <p className="text-[11px] text-zinc-400 mb-1">経費合計</p>
        <p className="text-xl font-bold text-zinc-900">
          ¥{totalExpense.toLocaleString()}
        </p>
      </div>

      {/* メインコンテンツ 2列 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 経費管理 */}
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-800">経費</h3>
            <span className="text-xs text-zinc-400">{project.expenses.length}件</span>
          </div>

          <ExpenseForm projectId={project.id} />
          <ExpenseList expenses={project.expenses} projectId={project.id} />
        </div>

        {/* ログ */}
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-800">ログ</h3>
            <span className="text-xs text-zinc-400">{project.logs.length}件</span>
          </div>
          <ProjectLogTimeline logs={project.logs} />
        </div>
      </div>

      {/* 戻るリンク */}
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        一覧に戻る
      </Link>
    </div>
  );
}
