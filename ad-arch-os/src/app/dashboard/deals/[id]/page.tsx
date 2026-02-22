import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import { BRANCH_MAP } from "@/lib/data/customers";
import { DealLogForm } from "@/components/deals/deal-log-form";
import { DealLogTimeline } from "@/components/deals/deal-log-timeline";
import { DealDeleteButton } from "@/components/deals/deal-delete-button";
import { WikiArticleContent } from "@/components/wiki/wiki-article-content";
import {
  ChevronLeft,
  Pencil,
  TrendingUp,
  Users,
  Calendar,
  Percent,
  Building2,
  Clock,
  User,
} from "lucide-react";
import type { UserRole } from "@/types/roles";

interface PageProps {
  params: Promise<{ id: string }>;
}

function fmtDate(d: Date | null | undefined, withYear = true): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: withYear ? "numeric" : undefined,
    month: "long",
    day: "numeric",
  }).format(new Date(d));
}

export default async function DealDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  const staffName = session?.user?.name ?? session?.user?.email ?? "不明";

  const deal = await db.deal.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, prefecture: true } },
      assignedTo: { select: { name: true, email: true } },
      dealLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!deal) notFound();

  const statusOpt = DEAL_STATUS_OPTIONS.find((o) => o.value === deal.status);
  const branchInfo = BRANCH_MAP[deal.branchId as keyof typeof BRANCH_MAP] ?? null;

  const isClosedStatus = deal.status === "CLOSED_WON" || deal.status === "CLOSED_LOST";

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto w-full">
      {/* ─── 戻るリンク ─── */}
      <Link
        href="/dashboard/deals"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        商談一覧
      </Link>

      {/* ─── ヘッダーカード ─── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
        {/* タイトル行 */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            {/* ステータスバッジ */}
            {statusOpt && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border mb-2 ${statusOpt.color}`}
              >
                <TrendingUp className="w-2.5 h-2.5" />
                {statusOpt.label}
              </span>
            )}

            {/* 顧客名（リンク） */}
            <h1 className="text-xl font-bold text-zinc-900 leading-snug mb-0.5">
              <Link
                href={`/dashboard/customers/${deal.customer.id}`}
                className="hover:text-blue-600 transition-colors inline-flex items-center gap-1"
              >
                {deal.customer.name}
                <Users className="w-4 h-4 text-zinc-300" />
              </Link>
            </h1>

            {/* 商談タイトル */}
            <p className="text-sm text-zinc-500">{deal.title}</p>
          </div>

          {/* 編集 / 削除ボタン */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/dashboard/deals/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         border border-zinc-200 rounded-lg bg-white text-zinc-700
                         hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              編集
            </Link>
            <DealDeleteButton dealId={deal.id} dealTitle={deal.title} />
          </div>
        </div>

        {/* 指標ライン */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-zinc-100">
          {deal.amount !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400 font-medium">金額</span>
              <span className="text-base font-bold text-zinc-900">
                ¥{Number(deal.amount).toLocaleString()}
              </span>
            </div>
          )}
          {deal.probability !== null && (
            <div className="flex items-center gap-1.5">
              <Percent className="w-3 h-3 text-zinc-400" />
              <span className="text-sm font-semibold text-zinc-700">{deal.probability}%</span>
            </div>
          )}
          {deal.expectedCloseDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-zinc-400" />
              <span className="text-sm text-zinc-600">{fmtDate(deal.expectedCloseDate)}</span>
            </div>
          )}
          {deal.assignedTo && (
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3 text-zinc-400" />
              <span className="text-sm text-zinc-600">{deal.assignedTo.name ?? deal.assignedTo.email}</span>
            </div>
          )}
          {branchInfo && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-zinc-400" />
              <span className="text-sm text-zinc-500">{branchInfo.name}</span>
            </div>
          )}
          {deal.customer.prefecture && (
            <span className="text-sm text-zinc-500">📍 {deal.customer.prefecture}</span>
          )}
        </div>

        {/* 日時フッター */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 pt-2.5 border-t border-zinc-100">
          <span className="flex items-center gap-1 text-[11px] text-zinc-400">
            <Clock className="w-3 h-3" />
            作成: {fmtDate(deal.createdAt)}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-zinc-400">
            <Clock className="w-3 h-3" />
            更新: {fmtDate(deal.updatedAt)}
          </span>
          {isClosedStatus && deal.closedAt && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600">
              <Clock className="w-3 h-3" />
              クローズ: {fmtDate(deal.closedAt)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* ─── 左カラム: メモ (Markdown) ─── */}
        <div className="lg:col-span-3 space-y-4">
          {deal.notes ? (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  商談メモ
                </h2>
              </div>
              <div className="px-5 py-4">
                <WikiArticleContent body={deal.notes} />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 border-dashed p-8 text-center">
              <p className="text-sm text-zinc-400">メモはありません</p>
              <Link
                href={`/dashboard/deals/${id}/edit`}
                className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Pencil className="w-3 h-3" />
                メモを追加
              </Link>
            </div>
          )}
        </div>

        {/* ─── 右カラム: 活動記録 ─── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden sticky top-4">
            {/* フォームヘッダー */}
            <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                今日の進捗を記録
              </h2>
            </div>
            <div className="p-4">
              <DealLogForm dealId={deal.id} staffName={staffName} />
            </div>

            {/* タイムライン */}
            <div className="border-t border-zinc-100">
              <div className="px-5 py-3 bg-zinc-50">
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  活動履歴 ({deal.dealLogs.length})
                </h2>
              </div>
              <DealLogTimeline logs={deal.dealLogs} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
