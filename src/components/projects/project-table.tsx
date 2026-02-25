import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRANCH_MAP } from "@/lib/data/customers";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants/projects";
import { ChevronRight, Calendar, Banknote, User } from "lucide-react";
import { DeleteProjectButton } from "./delete-project-button";

export type ProjectRow = {
  id: string;
  title: string;
  status: string;
  deadline: Date | null;
  budget: { toNumber(): number } | null;
  staffName: string | null;
  branchId: string;
  customer: { id: string; name: string } | null;
};

interface Props {
  projects: ProjectRow[];
  isAdmin?: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const opt = PROJECT_STATUS_OPTIONS.find((o) => o.value === status);
  if (!opt) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
        opt.className
      )}
    >
      {opt.icon} {opt.label}
    </span>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatBudget(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ProjectTable({ projects, isAdmin = false }: Props) {
  if (projects.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-2xl mb-3">📁</p>
        <p className="text-sm text-zinc-500">プロジェクトがありません</p>
        <p className="text-xs text-zinc-400 mt-1">
          「＋新規プロジェクト」ボタンから最初のプロジェクトを作成しましょう
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 min-w-[200px]">
                プロジェクト名
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-28">
                ステータス
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-36">
                顧客
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-32">
                納期
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-32">
                予算
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-28">
                担当者
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 w-28">
                拠点
              </th>
              <th className="w-10" />
              {isAdmin && <th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {projects.map((project) => {
              const branch = BRANCH_MAP[project.branchId as keyof typeof BRANCH_MAP];
              const isOverdue =
                project.deadline &&
                project.deadline < new Date() &&
                project.status !== "COMPLETED" &&
                project.status !== "CANCELLED";

              return (
                <tr
                  key={project.id}
                  className="hover:bg-zinc-50 transition-colors"
                >
                  {/* プロジェクト名 */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 leading-snug">
                      {project.title}
                    </p>
                  </td>

                  {/* ステータス */}
                  <td className="px-4 py-3">
                    <StatusBadge status={project.status} />
                  </td>

                  {/* 顧客 */}
                  <td className="px-4 py-3">
                    {project.customer ? (
                      <Link
                        href={`/dashboard/customers/${project.customer.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {project.customer.name}
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>

                  {/* 納期 */}
                  <td className="px-4 py-3">
                    {project.deadline ? (
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          isOverdue ? "text-red-600 font-semibold" : "text-zinc-600"
                        )}
                      >
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        {formatDate(project.deadline)}
                        {isOverdue && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">
                            期限超過
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>

                  {/* 予算 */}
                  <td className="px-4 py-3">
                    {project.budget ? (
                      <span className="flex items-center gap-1 text-xs text-zinc-700 font-medium tabular-nums">
                        <Banknote className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                        {formatBudget(project.budget.toNumber())}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>

                  {/* 担当者 */}
                  <td className="px-4 py-3">
                    {project.staffName ? (
                      <span className="flex items-center gap-1.5 text-xs text-zinc-600">
                        <User className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                        {project.staffName}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>

                  {/* 拠点 */}
                  <td className="px-4 py-3">
                    {branch ? (
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          branch.badgeClass
                        )}
                      >
                        {branch.code} · {branch.name}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">
                        {project.branchId}
                      </span>
                    )}
                  </td>

                  {/* 詳細リンク */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>

                  {/* 削除（Admin のみ） */}
                  {isAdmin && (
                    <td className="px-2 py-3">
                      <DeleteProjectButton
                        projectId={project.id}
                        projectTitle={project.title}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
