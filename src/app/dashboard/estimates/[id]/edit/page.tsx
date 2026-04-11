import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";
import { EstimateForm, type EstimationInitialData } from "@/components/estimates/estimate-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  // ローカル日付ではなく UTC ベースで yyyy-mm-dd を返す（入力済み見積の表示用）
  return new Date(d).toISOString().slice(0, 10);
}

export default async function EditEstimatePage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  const staffName = session?.user?.name ?? session?.user?.email ?? "不明";
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const whereClause =
    role === "ADMIN" || !userBranchId ? { id } : { id, branchId: userBranchId };

  const [estimation, templates, customers, projects] = await Promise.all([
    db.estimation.findFirst({
      where: whereClause,
      include: {
        items: { orderBy: { sortOrder: "asc" } },
      },
    }),
    db.estimationTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.customer.findMany({
      where: role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: role === "ADMIN" || !userBranchId ? {} : { branchId: userBranchId },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  if (!estimation) notFound();

  // 承認済みは編集不可
  if (estimation.status === "ACCEPTED") {
    return (
      <div className="px-6 py-10 max-w-2xl mx-auto w-full text-center">
        <div className="bg-white rounded-xl border border-zinc-200 px-6 py-10">
          <p className="text-4xl mb-3">🔒</p>
          <h1 className="text-lg font-bold text-zinc-900 mb-2">この見積は編集できません</h1>
          <p className="text-sm text-zinc-500 mb-5">
            承認済みの見積書は内容を変更できません。修正が必要な場合は、新規見積書を作成してください。
          </p>
          <Link
            href={`/dashboard/estimates/${estimation.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            詳細に戻る
          </Link>
        </div>
      </div>
    );
  }

  const templateOptions = templates.map((t) => ({
    id: t.id,
    category: t.category,
    name: t.name,
    unitPrice: Number(t.unitPrice),
    unit: t.unit,
    spec: t.spec,
    costPrice: t.costPrice !== null ? Number(t.costPrice) : null,
  }));

  const initialData: EstimationInitialData = {
    id: estimation.id,
    title: estimation.title,
    estimateDate: toDateInput(estimation.estimateDate),
    validUntil: estimation.validUntil ? toDateInput(estimation.validUntil) : null,
    notes: estimation.notes,
    customerId: estimation.customerId,
    projectId: estimation.projectId,
    discountAmount: estimation.discountAmount ? Number(estimation.discountAmount) : 0,
    discountReason: estimation.discountReason,
    discountReasonNote: estimation.discountReasonNote,
    items: estimation.items.map((it) => ({
      name: it.name,
      spec: it.spec ?? "",
      quantity: it.quantity,
      unit: it.unit ?? "",
      unitPrice: Number(it.unitPrice),
      costPrice: it.costPrice !== null ? Number(it.costPrice) : null,
      templateId: it.templateId,
    })),
  };

  return (
    <div className="px-6 py-6 space-y-4 max-w-5xl mx-auto w-full">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/estimates" className="hover:text-zinc-800 transition-colors">
          公式見積もり
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/estimates/${estimation.id}`}
          className="hover:text-zinc-800 transition-colors truncate max-w-[200px]"
        >
          {estimation.title}
        </Link>
        <span>/</span>
        <span className="text-zinc-400">編集</span>
      </div>

      {/* ページタイトル */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <FileText className="text-blue-600" style={{ width: "1rem", height: "1rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">見積書を編集</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            更新するとステータスは維持されます（承認済みは編集不可）
          </p>
        </div>
      </div>

      <Link
        href={`/dashboard/estimates/${estimation.id}`}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        詳細に戻る
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
          mode="edit"
          initialData={initialData}
        />
      </div>
    </div>
  );
}
