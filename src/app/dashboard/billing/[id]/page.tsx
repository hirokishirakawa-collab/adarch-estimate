import Link from "next/link";
import { CreditCard, Pencil, ArrowLeft, FileText, ExternalLink } from "lucide-react";
import { getInvoiceRequestWithAuth, submitInvoiceRequest } from "@/lib/actions/billing";
import { commissionBaseOf, commissionOf } from "@/lib/royalty-monthly";

const STATUS_CONFIG = {
  DRAFT:     { label: "未提出",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  SUBMITTED: { label: "提出済",  className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
} as const;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BillingDetailPage({ params }: Props) {
  const { id } = await params;
  const { request, role } = await getInvoiceRequestWithAuth(id);

  const statusCfg  = STATUS_CONFIG[request.status];
  const isAdmin    = role === "ADMIN";
  const fmtAmt     = (n: number | { toString(): string }) =>
    `¥${Number(n).toLocaleString("ja-JP")}`;
  const fmtDate    = (d: Date | null) =>
    d
      ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(new Date(d))
      : "—";

  // 立替実費（本部手数料の対象外）。未設定は0。
  const reimbursementExclTax = Number(request.reimbursementExclTax ?? 0);

  // 本部手数料。フィールド追加前の既存データは「税抜金額 − 立替実費」から再計算して表示する。
  // 媒体請求は取り分の条件が案件ごとに違うため、手数料は常に0（フォールバックも通さない）。
  const isMedia = request.kind === "MEDIA";
  const commissionExclTax = isMedia
    ? 0
    : request.commissionExclTax != null
      ? Number(request.commissionExclTax)
      : commissionOf(
          commissionBaseOf(Number(request.amountExclTax), reimbursementExclTax),
          Number(request.commissionRate),
        );
  const commissionTax = Math.floor(commissionExclTax * 0.1);

  // 差引支払額は保存値を使わず表示時に再計算する。
  // 手数料フィールド追加前に保存された netPaymentAmount は手数料を引いていないため。
  const netPaymentAmount =
    Number(request.amountInclTax) - commissionExclTax - commissionTax
    - Number(request.withholdingTaxAmount ?? 0)
    - Number(request.nonDeductibleTaxAmount ?? 0);

  const submitAction = submitInvoiceRequest.bind(null, id);

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      {/* 戻るリンク */}
      <Link href="/dashboard/billing"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800
                       transition-colors mb-5">
        <ArrowLeft className="w-3.5 h-3.5" />請求依頼一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <CreditCard className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">{request.subject}</h2>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold
                                rounded-full border ${statusCfg.className}`}>
                {statusCfg.label}
              </span>
              {isMedia && (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  媒体請求（手数料なし）
                </span>
              )}
            </div>
          </div>
        </div>

        <Link href={`/dashboard/billing/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 text-zinc-700
                         text-xs font-medium rounded-lg hover:bg-zinc-200 transition-colors">
          <Pencil className="w-3.5 h-3.5" />編集
        </Link>
      </div>

      {/* 詳細テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden mb-5">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-50">
            {[
              ["請求先名",       request.customer?.name ?? "—"],
              ["担当者名",       request.contactName ?? "—"],
              ["担当者メール",   request.contactEmail || "—"],
              ["請求日",         fmtDate(request.billingDate)],
              ["支払期限",       fmtDate(request.dueDate)],
              ["検収状況",       request.inspectionStatus ?? "—"],
            ].map(([label, value]) => (
              <tr key={label}>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                               whitespace-nowrap w-[140px] bg-zinc-50 align-top">
                  {label}
                </th>
                <td className="px-5 py-3 text-sm text-zinc-800">{value}</td>
              </tr>
            ))}

            {/* 内訳 */}
            {request.details && (
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                               whitespace-nowrap bg-zinc-50 align-top">
                  内訳
                </th>
                <td className="px-5 py-3 text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                  {request.details}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 金額カード */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100
                      rounded-xl px-6 py-5 mb-5 grid grid-cols-3 gap-4 text-center">
        {[
          { label: "税抜金額",        value: fmtAmt(request.amountExclTax) },
          { label: "消費税（10%）",   value: fmtAmt(request.taxAmount) },
          { label: "税込合計",        value: fmtAmt(request.amountInclTax), accent: true },
        ].map(({ label, value, accent }) => (
          <div key={label}>
            <p className="text-[11px] text-violet-500 font-semibold mb-1">{label}</p>
            <p className={`text-lg font-bold ${accent ? "text-violet-800" : "text-zinc-700"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* 控除・お受け取り予定額 */}
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 mb-5 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-600">
            本部手数料{isMedia ? "" : `（${Number(request.commissionRate)}%・税抜）`}
          </span>
          {isMedia ? (
            <span className="font-semibold text-zinc-500">媒体請求のためなし</span>
          ) : (
            <span className="font-bold text-red-600">-{fmtAmt(commissionExclTax)}</span>
          )}
        </div>
        {reimbursementExclTax > 0 && (
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span className="pl-3">
              手数料の対象 {fmtAmt(commissionBaseOf(Number(request.amountExclTax), reimbursementExclTax))}
              （立替実費 {fmtAmt(reimbursementExclTax)} を除く）
            </span>
          </div>
        )}
        {request.withholdingTaxAmount != null && Number(request.withholdingTaxAmount) > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-zinc-600">源泉徴収税</span>
            <span className="font-bold text-red-600">-{fmtAmt(request.withholdingTaxAmount)}</span>
          </div>
        )}
        {request.nonDeductibleTaxAmount != null && Number(request.nonDeductibleTaxAmount) > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-zinc-600">控除不可消費税（インボイス未登録）</span>
            <span className="font-bold text-red-600">-{fmtAmt(request.nonDeductibleTaxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm pt-2 border-t border-zinc-100">
          <span className="font-semibold text-zinc-700">差引支払額（お受け取り予定額）</span>
          <span className="font-bold text-indigo-700">{fmtAmt(netPaymentAmount)}</span>
        </div>
        <p className="text-[11px] text-zinc-400 pt-1">
          {isMedia
            ? "媒体請求はロイヤリティの相殺に含まれません。取り分が必要な場合は本部が別途調整します。"
            : "本部手数料はロイヤリティの相殺に充当されます。"}
          <Link href="/dashboard/royalty" className="ml-1 text-indigo-600 hover:underline">
            今月のロイヤリティ状況を見る →
          </Link>
        </p>
      </div>

      {/* プロジェクト */}
      {request.project && (
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-3 mb-5
                        flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-semibold">関連プロジェクト</span>
          <Link href={`/dashboard/projects/${request.project.id}`}
                className="text-sm text-violet-600 hover:underline flex items-center gap-1">
            {request.project.title}
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* PDF ファイル */}
      {request.fileUrl && (
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-3 mb-5
                        flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-semibold">請求書PDF</span>
          <a href={request.fileUrl} target="_blank" rel="noopener noreferrer"
             className="text-sm text-violet-600 hover:underline flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />PDFを開く
          </a>
        </div>
      )}

      {/* 備考 */}
      {request.notes && (
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 mb-5">
          <p className="text-xs font-semibold text-zinc-500 mb-2">備考</p>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
            {request.notes}
          </p>
        </div>
      )}

      {/* メタ情報 */}
      <p className="text-xs text-zinc-400 mb-5">
        申請者: {request.createdBy?.name ?? request.creatorEmail} ／
        申請日: {fmtDate(request.createdAt)}
      </p>

      {/* ADMIN 専用: 提出済ボタン */}
      {isAdmin && request.status === "DRAFT" && (
        <form action={submitAction}>
          <button type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg
                             hover:bg-emerald-700 transition-colors">
            提出済みにする
          </button>
        </form>
      )}
    </div>
  );
}
