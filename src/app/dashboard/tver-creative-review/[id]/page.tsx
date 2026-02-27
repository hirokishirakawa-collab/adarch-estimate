import Link from "next/link";
import { ArrowLeft, Tv2, ExternalLink } from "lucide-react";
import { getTverCreativeReviewById } from "@/lib/actions/tver-creative-review";
import { DeleteButton } from "./DeleteButton";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: "申請中", className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED:  { label: "承認",   className: "bg-green-50 text-green-700 border-green-200" },
  REJECTED:  { label: "否決",   className: "bg-red-50   text-red-700   border-red-200"   },
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(new Date(d));
}

export default async function TverCreativeReviewDetailPage({ params }: Props) {
  const { id } = await params;
  const { review, role } = await getTverCreativeReviewById(id);
  const isAdmin = role === "ADMIN";
  const status = STATUS_LABEL[review.status] ?? STATUS_LABEL.SUBMITTED;

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      {/* 戻るリンク＋削除ボタン */}
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/dashboard/tver-creative-review"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800
                     transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />クリエイティブ考査一覧に戻る
        </Link>
        {isAdmin && <DeleteButton id={review.id} />}
      </div>

      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Tv2 className="text-blue-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">{review.projectName}</h2>
          <span className={`mt-1 inline-flex items-center px-2 py-0.5 text-[11px] font-semibold
                             rounded-full border ${status.className}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* 申請内容 */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden mb-5">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-50">
            {[
              ["広告主",         review.advertiser?.name ?? "—"],
              ["プロジェクト名", review.projectName],
              ["本数",           `${review.numberOfAssets}本`],
              ["ステータス",     status.label],
              ["登録拠点",       review.branch?.name ?? "—"],
            ].map(([label, value]) => (
              <tr key={label as string}>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                               whitespace-nowrap w-[160px] bg-zinc-50 align-top">
                  {label}
                </th>
                <td className="px-5 py-3 text-sm text-zinc-800">{value}</td>
              </tr>
            ))}

            {/* データ格納リンク */}
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                             whitespace-nowrap bg-zinc-50 align-top">
                データ格納リンク
              </th>
              <td className="px-5 py-3">
                <a
                  href={review.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 break-all"
                >
                  {review.driveUrl}
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
      <p className="text-xs text-zinc-400">
        申請者: {review.createdBy?.name ?? "—"} ／ 申請日: {fmtDate(review.createdAt)}
      </p>
    </div>
  );
}
