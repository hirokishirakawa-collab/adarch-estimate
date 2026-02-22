import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";
import { EstimateForm } from "@/components/estimates/estimate-form";

export default async function NewEstimatePage() {
  const session = await auth();
  const staffName = session?.user?.name ?? session?.user?.email ?? "不明";
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const [templates, customers, projects] = await Promise.all([
    // 標準単価マスタ（全社共通）
    db.estimationTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    // 顧客一覧
    db.customer.findMany({
      where: role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // プロジェクト一覧
    db.project.findMany({
      where: role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  // Decimal を number に変換してクライアントに渡す
  const templateOptions = templates.map((t) => ({
    id: t.id,
    category: t.category,
    name: t.name,
    unitPrice: Number(t.unitPrice),
    unit: t.unit,
    spec: t.spec,
    costPrice: t.costPrice !== null ? Number(t.costPrice) : null,
  }));

  return (
    <div className="px-6 py-6 space-y-4 max-w-5xl mx-auto w-full">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/estimates" className="hover:text-zinc-800 transition-colors">
          公式見積もり
        </Link>
        <span>/</span>
        <span className="text-zinc-400">新規作成</span>
      </div>

      {/* ページタイトル */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <FileText className="text-blue-600" style={{ width: "1rem", height: "1rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">新規見積書を作成</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            品目名を入力すると標準単価マスタから自動補完されます
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/estimates"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        一覧に戻る
      </Link>

      {/* マスタ説明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <p className="text-xs text-blue-700 font-medium mb-1">📋 標準単価マスタ（{templates.length}件）</p>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <span key={t.id} className="text-[11px] bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full">
              {t.name} ¥{Number(t.unitPrice).toLocaleString()}/{t.unit}
            </span>
          ))}
        </div>
      </div>

      {/* フォーム */}
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-6">
        <EstimateForm
          staffName={staffName}
          templates={templateOptions}
          customers={customers}
          projects={projects}
        />
      </div>
    </div>
  );
}
