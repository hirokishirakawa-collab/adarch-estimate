import { auth } from "@/lib/auth";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";
import { EstimateTable } from "@/components/estimates/estimate-table";
import { ESTIMATION_STATUS_OPTIONS } from "@/lib/constants/estimates";

export default async function EstimatesPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  // ADMIN: 全件、非 ADMIN: 自分が作成した見積書のみ
  // createdByEmail が null の古いデータは自拠点ユーザー全員が閲覧可（後方互換）
  const where =
    role === "ADMIN"
      ? {}
      : {
          OR: [
            { createdByEmail: email },
            { createdByEmail: null, branchId: userBranchId ?? undefined },
          ],
        };

  const [estimations, totalByStatus] = await Promise.all([
    db.estimation.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        items: { select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.estimation.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    }),
  ]);

  const statusCount = Object.fromEntries(
    totalByStatus.map((r) => [r.status, r._count.status])
  );

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <FileText className="text-blue-600 w-4.5 h-4.5" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">公式見積もり</h2>
            <p className="text-xs text-zinc-500 mt-0.5">標準単価マスタを使って素早く見積書を作成</p>
          </div>
        </div>
        <Link href="/dashboard/estimates/new">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            新規見積書
          </button>
        </Link>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-500">全件</p>
          <p className="text-xl font-bold text-zinc-900 mt-0.5">{estimations.length}</p>
        </div>
        {ESTIMATION_STATUS_OPTIONS.map((opt) => (
          <div key={opt.value} className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
            <p className="text-[11px] text-zinc-500">{opt.icon} {opt.label}</p>
            <p className="text-xl font-bold text-zinc-900 mt-0.5">{statusCount[opt.value] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <EstimateTable estimations={estimations} />
      </div>
    </div>
  );
}
