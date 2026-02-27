"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { Tv2, ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import {
  updateAdvertiserReviewStatus,
  getAdvertiserReviewById,
} from "@/lib/actions/advertiser-review";
import {
  ADVERTISER_REVIEW_STATUS_OPTIONS,
  getReviewStatusOption,
} from "@/lib/constants/advertiser-review";

interface Props {
  params: Promise<{ id: string }>;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(new Date(d));
}

function StatusUpdateForm({
  reviewId,
  currentStatus,
  currentReviewNote,
}: {
  reviewId: string;
  currentStatus: string;
  currentReviewNote: string | null;
}) {
  const boundAction = updateAdvertiserReviewStatus.bind(null, reviewId);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  const inputCls =
    "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
    "focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 " +
    "bg-white text-zinc-900";

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          考査ステータス
        </label>
        <select name="status" defaultValue={currentStatus} className={inputCls}>
          {ADVERTISER_REVIEW_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          審査コメント
          <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
        </label>
        <textarea
          name="reviewNote"
          rows={5}
          defaultValue={currentReviewNote ?? ""}
          placeholder="承認・否決の理由や補足事項を記入してください（申請者にメールで通知されます）"
          className={`${inputCls} resize-y`}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-700 text-white
                   text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60
                   transition-colors"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        審査結果を保存する
      </button>
    </form>
  );
}

export default function AdvertiserReviewDetailPage({ params }: Props) {
  const { id } = use(params);
  const { review, role } = use(getAdvertiserReviewById(id));
  const isAdmin = role === "ADMIN";
  const statusOpt = getReviewStatusOption(review.status);

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      {/* 戻るリンク */}
      <Link
        href="/dashboard/tver-review"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800
                   transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />業態考査一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Tv2 className="text-blue-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">{review.name}</h2>
          <span
            className={`mt-1 inline-flex items-center px-2 py-0.5 text-[11px] font-semibold
                         rounded-full border ${statusOpt.className}`}
          >
            {statusOpt.label}
          </span>
        </div>
      </div>

      {/* 申請内容 */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden mb-5">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-50">
            {[
              ["広告主様名", review.name],
              ["考査ステータス", statusOpt.label],
              ["法人番号",
                review.hasNoCorporateNumber
                  ? "なし（個人事業主・任意団体など）"
                  : review.corporateNumber ?? "—",
              ],
              ["広告展開希望日", fmtDate(review.desiredStartDate)],
              ["登録拠点",  review.branch?.name ?? "—"],
            ].map(([label, value]) => (
              <tr key={label as string}>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                               whitespace-nowrap w-[150px] bg-zinc-50 align-top">
                  {label}
                </th>
                <td className="px-5 py-3 text-sm text-zinc-800">{value}</td>
              </tr>
            ))}

            {/* 企業ページ URL */}
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                             whitespace-nowrap bg-zinc-50 align-top">
                企業ページURL
              </th>
              <td className="px-5 py-3">
                <a
                  href={review.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {review.websiteUrl}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </td>
            </tr>

            {/* 商材サイト URL */}
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                             whitespace-nowrap bg-zinc-50 align-top">
                商材サイトURL
              </th>
              <td className="px-5 py-3">
                <a
                  href={review.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {review.productUrl}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </td>
            </tr>

            {/* 備考 */}
            {review.remarks && (
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                               whitespace-nowrap bg-zinc-50 align-top">
                  備考
                </th>
                <td className="px-5 py-3 text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                  {review.remarks}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* メタ情報 */}
      <p className="text-xs text-zinc-400 mb-2">
        申請者: {review.createdBy?.name ?? "—"} ／
        申請日: {fmtDate(review.createdAt)}
      </p>
      {review.reviewedBy && (
        <p className="text-xs text-zinc-400 mb-6">
          審査者: {review.reviewedBy.name} ／
          審査日: {fmtDate(review.reviewedAt)}
        </p>
      )}

      {/* 審査コメント表示（全員） */}
      {review.reviewNote && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-5 py-4 mb-5">
          <p className="text-xs font-semibold text-zinc-500 mb-2">審査コメント</p>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
            {review.reviewNote}
          </p>
        </div>
      )}

      {/* ステータス更新フォーム（ADMIN のみ） */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-4">考査ステータス更新</p>
          <StatusUpdateForm
            reviewId={review.id}
            currentStatus={review.status}
            currentReviewNote={review.reviewNote}
          />
        </div>
      )}
    </div>
  );
}
