import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { ChevronLeft, FolderKanban } from "lucide-react";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";

interface PageProps {
  searchParams: Promise<{ customerId?: string }>;
}

export default async function NewProjectPage({ searchParams }: PageProps) {
  const session = await auth();
  const staffName = session?.user?.name ?? session?.user?.email ?? "不明";
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const { customerId } = await searchParams;

  // 顧客一覧を取得（ドロップダウン用）
  const [customer, customers] = await Promise.all([
    // URLに customerId がある場合はその顧客情報を取得
    customerId
      ? db.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    // ロール別に顧客一覧を取得
    db.customer.findMany({
      where: role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="px-6 py-6 space-y-4 max-w-3xl mx-auto w-full">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/projects" className="hover:text-zinc-800 transition-colors">
          プロジェクト管理
        </Link>
        <span>/</span>
        <span className="text-zinc-400">新規作成</span>
      </div>

      {/* ページタイトル */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
          <FolderKanban
            className="text-violet-600"
            style={{ width: "1rem", height: "1rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">新規プロジェクトを作成</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            受注案件の情報を登録します
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        一覧に戻る
      </Link>

      {/* 作成フォーム */}
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-6">
        <NewProjectForm
          staffName={staffName}
          customers={customers}
          prefillCustomer={customer}
        />
      </div>
    </div>
  );
}
