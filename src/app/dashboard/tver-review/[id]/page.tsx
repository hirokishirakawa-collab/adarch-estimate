import Link from "next/link";
import { Tv2, ArrowLeft, ExternalLink } from "lucide-react";
import { getAdvertiserReviewById } from "@/lib/actions/advertiser-review";
import { getReviewStatusOption } from "@/lib/constants/advertiser-review";
import { StatusUpdateForm } from "./StatusUpdateForm";
import { DeleteButton } from "./DeleteButton";

interface Props {
  params: Promise<{ id: string }>;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(new Date(d));
}

export default async function AdvertiserReviewDetailPage({ params }: Props) {
  const { id } = await params;
  const { review, role } = await getAdvertiserReviewById(id);
  const isAdmin = role === "ADMIN";
  const statusOpt = getReviewStatusOption(review.status);

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      {/* 戻るリンク＋削除ボタン */}
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/dashboard/tver-review"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800
                     transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />業態考査一覧に戻る
        </Link>
        {isAdmin && <DeleteButton reviewId={review.id} />}
      </div>

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
              [
                "法人番号",
                review.hasNoCorporateNumber
                  ? "なし（個人事業主・任意団体など）"
                  : review.corporateNumber ?? "—",
              ],
              ["広告展開希望日", fmtDate(review.desiredStartDate)],
              ["登録拠点", review.branch?.name ?? "—"],
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
