import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { ESTIMATION_STATUS_OPTIONS } from "@/lib/constants/estimates";
import type { UserRole } from "@/types/roles";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  FileText,
  Calendar,
  User,
  Building2,
  TrendingUp,
  TrendingDown,
  Scissors,
  Download,
} from "lucide-react";
import { DeleteEstimateButton } from "@/components/estimates/delete-estimate-button";

const DISCOUNT_REASON_LABELS: Record<string, string> = {
  BUDGET_FIRST: "予算先行型（顧客予算が先に決定）",
  EXISTING:     "既存優待（既存顧客・累積利益あり）",
  INVESTMENT:   "先行投資（初受注・リピート期待）",
  OTHER:        "その他",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EstimateDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const email = session?.user?.email ?? "";
  const userBranchId = getMockBranchId(email, role);

  const whereClause =
    role === "ADMIN" || !userBranchId ? { id } : { id, branchId: userBranchId };

  const estimation = await db.estimation.findFirst({
    where: whereClause,
    include: {
      customer: { select: { id: true, name: true } },
      project:  { select: { id: true, title: true } },
      branch:   { select: { name: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!estimation) notFound();

  const statusOpt = ESTIMATION_STATUS_OPTIONS.find((o) => o.value === estimation.status);

  // 金額計算
  const subtotal      = estimation.items.reduce((s, it) => s + Number(it.amount), 0);
  const discountAmt   = estimation.discountAmount ? Number(estimation.discountAmount) : 0;
  const afterDiscount = Math.max(0, subtotal - discountAmt);
  const tax           = Math.round(afterDiscount * 0.1);
  const total         = afterDiscount + tax;

  // 原価・粗利（内部用）
  const hasCost     = estimation.items.some((it) => it.costPrice !== null);
  const costTotal   = estimation.items.reduce((s, it) => s + (it.costPrice ? Number(it.costPrice) * it.quantity : 0), 0);
  const grossProfit = afterDiscount - costTotal;
  const profitRate  = afterDiscount > 0 ? (grossProfit / afterDiscount) * 100 : 0;

  const fmt = (d: Date | null | undefined) =>
    d
      ? new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(new Date(d))
      : "—";

  return (
    <div className="px-6 py-6 space-y-5 max-w-4xl mx-auto w-full">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/estimates" className="hover:text-zinc-800 transition-colors">
          公式見積もり
        </Link>
        <span>/</span>
        <span className="text-zinc-400 truncate max-w-xs">{estimation.title}</span>
      </div>

      {/* ヘッダーカード */}
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">

            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="text-blue-600 w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                {statusOpt && (
                  <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border", statusOpt.className)}>
                    {statusOpt.icon} {statusOpt.label}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-zinc-900">{estimation.title}</h1>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`/api/estimates/${estimation.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              PDFダウンロード
            </a>
            {role === "ADMIN" && <DeleteEstimateButton id={estimation.id} />}
          </div>
        </div>

        {/* 基本情報グリッド */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-zinc-100">
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> 見積日
            </p>
            <p className="text-sm font-semibold text-zinc-700">{fmt(estimation.estimateDate)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> 有効期限
            </p>
            <p className="text-sm font-semibold text-zinc-700">{fmt(estimation.validUntil)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <User className="w-3 h-3" /> 担当者
            </p>
            <p className="text-sm font-semibold text-zinc-700">{estimation.staffName ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> 顧客
            </p>
            {estimation.customer ? (
              <Link
                href={`/dashboard/customers/${estimation.customer.id}`}
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                {estimation.customer.name}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-zinc-400">—</p>
            )}
          </div>
        </div>

        {estimation.project && (
          <div className="mt-3 pt-3 border-t border-zinc-100">
            <p className="text-[10px] text-zinc-400 mb-1">関連プロジェクト</p>
            <Link
              href={`/dashboard/projects/${estimation.project.id}`}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              {estimation.project.title}
            </Link>
          </div>
        )}
      </div>

      {/* 明細テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-bold text-zinc-800">見積明細</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 min-w-[160px]">品目名</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500">仕様・備考</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 w-16">数量</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 w-12">単位</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 w-28">単価</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 w-28">金額</th>
                {hasCost && (
                  <>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-amber-500 w-28">原価/単（内部）</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-amber-500 w-24">粗利（内部）</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {estimation.items.map((item) => {
                const amount = Number(item.amount);
                const costPerUnit = item.costPrice ? Number(item.costPrice) : null;
                const costAmt = costPerUnit !== null ? costPerUnit * item.quantity : null;
                const gp = costAmt !== null ? amount - costAmt : null;
                const gpRate = amount > 0 && gp !== null ? (gp / amount) * 100 : null;

                return (
                  <tr key={item.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3 font-medium text-zinc-800">{item.name}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-pre-wrap">{item.spec ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-zinc-700 tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-3 text-zinc-500">{item.unit ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-zinc-700 tabular-nums">
                      ¥{Number(item.unitPrice).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-800 tabular-nums">
                      ¥{amount.toLocaleString()}
                    </td>
                    {hasCost && (
                      <>
                        <td className="px-4 py-3 text-right text-xs text-amber-700 tabular-nums">
                          {costPerUnit !== null ? `¥${costPerUnit.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums">
                          {gp !== null ? (
                            <span className={cn("font-semibold", gp >= 0 ? "text-emerald-600" : "text-red-600")}>
                              ¥{gp.toLocaleString()}
                              {gpRate !== null && (
                                <span className="ml-1 text-[10px] text-zinc-400">({gpRate.toFixed(0)}%)</span>
                              )}
                            </span>
                          ) : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 合計フッター */}
        <div className="px-5 py-4 border-t border-zinc-100 bg-zinc-50 flex flex-col items-end gap-1.5">
          <div className="flex gap-10 text-sm text-zinc-600">
            <span>小計（税抜）</span>
            <span className="tabular-nums font-medium w-32 text-right">¥{subtotal.toLocaleString()}</span>
          </div>
          {discountAmt > 0 && (
            <>
              <div className="flex gap-10 text-sm text-orange-600">
                <span className="flex items-center gap-1"><Scissors className="w-3.5 h-3.5" /> 出精値引き</span>
                <span className="tabular-nums w-32 text-right">−¥{discountAmt.toLocaleString()}</span>
              </div>
              <div className="flex gap-10 text-sm text-zinc-600 pt-1 border-t border-zinc-200 mt-0.5">
                <span>値引後小計</span>
                <span className="tabular-nums font-medium w-32 text-right">¥{afterDiscount.toLocaleString()}</span>
              </div>
            </>
          )}
          <div className="flex gap-10 text-sm text-zinc-500">
            <span>消費税（10%）</span>
            <span className="tabular-nums w-32 text-right">¥{tax.toLocaleString()}</span>
          </div>
          <div className="flex gap-10 text-base font-bold text-zinc-900 pt-1.5 border-t border-zinc-200 mt-1">
            <span>合計（税込）</span>
            <span className="tabular-nums text-blue-700 w-32 text-right">¥{total.toLocaleString()}</span>
          </div>

          {/* 値引き理由（内部用） */}
          {discountAmt > 0 && estimation.discountReason && (
            <div className="mt-2 pt-2 border-t border-dashed border-orange-200 w-full max-w-sm ml-auto">
              <p className="text-[11px] text-orange-500 font-semibold mb-1">▼ 値引き情報（内部用・PDF非出力）</p>
              <p className="text-xs text-zinc-600">
                理由: {DISCOUNT_REASON_LABELS[estimation.discountReason] ?? estimation.discountReason}
              </p>
              {estimation.discountReason === "OTHER" && estimation.discountReasonNote && (
                <p className="text-xs text-zinc-500 mt-0.5">{estimation.discountReasonNote}</p>
              )}
            </div>
          )}

          {/* 原価・粗利（内部用） */}
          {hasCost && (
            <div className="mt-3 pt-3 border-t border-dashed border-amber-200 space-y-1.5 w-full max-w-sm ml-auto">
              <p className="text-[11px] text-amber-500 font-semibold">▼ スタッフ内部情報（PDF非出力）</p>
              <div className="flex justify-between text-xs text-amber-700">
                <span>原価合計</span>
                <span className="tabular-nums">¥{costTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-amber-700">粗利{discountAmt > 0 ? "（値引後）" : ""}</span>
                <span className={cn("tabular-nums font-bold", grossProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                  ¥{grossProfit.toLocaleString()}
                  <span className="ml-1 text-[10px] text-zinc-400">
                    {grossProfit >= 0 ? <TrendingUp className="inline w-3 h-3" /> : <TrendingDown className="inline w-3 h-3" />}
                    {" "}{profitRate.toFixed(1)}%
                  </span>
                </span>
              </div>
              {/* 粗利率ゲージ */}
              <div className="pt-1">
                <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      profitRate >= 40 ? "bg-emerald-500" : profitRate >= 20 ? "bg-amber-400" : "bg-red-500"
                    )}
                    style={{ width: `${Math.min(Math.max(profitRate, 0), 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">
                  {profitRate >= 40 ? "✅ 良好" : profitRate >= 20 ? "⚠️ 要確認" : "🔴 要注意"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 備考 */}
      {estimation.notes && (
        <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
          <h3 className="text-xs font-semibold text-zinc-500 mb-2">備考</h3>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{estimation.notes}</p>
        </div>
      )}

      {/* 戻るリンク */}
      <Link
        href="/dashboard/estimates"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        一覧に戻る
      </Link>
    </div>
  );
}
