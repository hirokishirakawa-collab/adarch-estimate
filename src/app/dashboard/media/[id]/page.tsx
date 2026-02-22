"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { Megaphone, ArrowLeft, FileText, ExternalLink, Loader2 } from "lucide-react";
import { updateMediaRequestStatus, getMediaRequestById } from "@/lib/actions/media";
import {
  MEDIA_REQUEST_STATUS_OPTIONS,
  getMediaTypeLabel,
  getStatusOption,
} from "@/lib/constants/media";

interface Props {
  params: Promise<{ id: string }>;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(new Date(d));
}

function StatusUpdateForm({
  requestId,
  currentStatus,
  currentReplyNote,
}: {
  requestId: string;
  currentStatus: string;
  currentReplyNote: string | null;
}) {
  const boundAction = updateMediaRequestStatus.bind(null, requestId);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  const inputCls =
    "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
    "focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 " +
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
          ステータス
        </label>
        <select name="status" defaultValue={currentStatus} className={inputCls}>
          {MEDIA_REQUEST_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          メモ・回答
        </label>
        <textarea
          name="replyNote" rows={5}
          defaultValue={currentReplyNote ?? ""}
          placeholder="対応内容や確認事項を記録してください"
          className={`${inputCls} resize-y`}
        />
      </div>

      <button
        type="submit" disabled={isPending}
        className="inline-flex items-center gap-1.5 px-5 py-2 bg-amber-600 text-white
                   text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-60
                   transition-colors"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        保存する
      </button>
    </form>
  );
}

export default function MediaDetailPage({ params }: Props) {
  const { id } = use(params);
  const { request } = use(getMediaRequestById(id));

  const statusOpt = getStatusOption(request.status);
  const period =
    request.startDate || request.endDate
      ? `${fmtDate(request.startDate)} 〜 ${fmtDate(request.endDate)}`
      : "—";

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      {/* 戻るリンク */}
      <Link
        href="/dashboard/media"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800
                   transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />媒体依頼一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Megaphone className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            {getMediaTypeLabel(request.mediaType)} — {request.mediaName}
          </h2>
          <span
            className={`mt-1 inline-flex items-center px-2 py-0.5 text-[11px] font-semibold
                         rounded-full border ${statusOpt.className}`}
          >
            {statusOpt.label}
          </span>
        </div>
      </div>

      {/* 依頼内容 */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden mb-5">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-50">
            {[
              ["媒体種別", getMediaTypeLabel(request.mediaType)],
              ["媒体名",   request.mediaName],
              ["顧客",     request.customer?.name ?? "—"],
              ["掲載期間", period],
              ["費用・予算", request.budget ?? "—"],
              ["登録拠点",  request.branch?.name ?? "—"],
            ].map(([label, value]) => (
              <tr key={label}>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                               whitespace-nowrap w-[140px] bg-zinc-50 align-top">
                  {label}
                </th>
                <td className="px-5 py-3 text-sm text-zinc-800">{value}</td>
              </tr>
            ))}

            {/* 依頼内容・備考 */}
            {request.description && (
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                               whitespace-nowrap bg-zinc-50 align-top">
                  依頼内容・備考
                </th>
                <td className="px-5 py-3 text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                  {request.description}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 顧客リンク */}
      {request.customer && (
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-3 mb-5
                        flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-semibold">顧客ページ</span>
          <Link
            href={`/dashboard/customers/${request.customer.id}`}
            className="text-sm text-amber-600 hover:underline flex items-center gap-1"
          >
            {request.customer.name}
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* 添付ファイル */}
      {request.attachmentUrl && (
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-3 mb-5
                        flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-semibold">添付ファイル</span>
          <a
            href={request.attachmentUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm text-amber-600 hover:underline flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />ファイルを開く
          </a>
        </div>
      )}

      {/* メタ情報 */}
      <p className="text-xs text-zinc-400 mb-6">
        申請者: {request.createdBy?.name ?? "—"} ／
        申請日: {fmtDate(request.createdAt)}
      </p>

      {/* ステータス更新フォーム */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <p className="text-sm font-semibold text-zinc-700 mb-4">ステータス更新</p>
        <StatusUpdateForm
          requestId={request.id}
          currentStatus={request.status}
          currentReplyNote={request.replyNote}
        />
      </div>

      {/* 現在のメモ表示 */}
      {request.replyNote && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-5 py-4 mt-4">
          <p className="text-xs font-semibold text-zinc-500 mb-2">現在のメモ</p>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
            {request.replyNote}
          </p>
        </div>
      )}
    </div>
  );
}
