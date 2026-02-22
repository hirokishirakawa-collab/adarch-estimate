"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { Network, ArrowLeft, FileText, ExternalLink, Loader2 } from "lucide-react";
import { updateCollaborationStatus, getCollaborationRequestById } from "@/lib/actions/group-sync";
import {
  COLLABORATION_STATUS_OPTIONS,
  getRequestTypeLabel,
  getStatusOption,
} from "@/lib/constants/group-sync";

// ---------------------------------------------------------------
// 詳細表示は Server Component にしたいが、回答フォームが
// useActionState を必要とするため、ページ全体を Client Component とする。
// データ取得は use() で行う。
// ---------------------------------------------------------------

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
  const boundAction = updateCollaborationStatus.bind(null, requestId);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  const inputCls =
    "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
    "focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 " +
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
          {COLLABORATION_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          やり取り・回答メモ
        </label>
        <textarea
          name="replyNote" rows={5}
          defaultValue={currentReplyNote ?? ""}
          placeholder="連携先とのやり取り内容や回答を記録してください"
          className={`${inputCls} resize-y`}
        />
      </div>

      <button
        type="submit" disabled={isPending}
        className="inline-flex items-center gap-1.5 px-5 py-2 bg-violet-600 text-white
                   text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-60
                   transition-colors"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        保存する
      </button>
    </form>
  );
}

export default function GroupSyncDetailPage({ params }: Props) {
  const { id } = use(params);
  const { request } = use(getCollaborationRequestById(id));

  const statusOpt = getStatusOption(request.status);

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      {/* 戻るリンク */}
      <Link
        href="/dashboard/group-sync"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800
                   transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />グループ連携依頼一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Network className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            {getRequestTypeLabel(request.requestType)}
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
              ["連携先代表", request.counterpartName],
              ["依頼種別",   getRequestTypeLabel(request.requestType)],
              ["希望予算",   request.budget ?? "—"],
              ["希望日",     fmtDate(request.desiredDate)],
              ["登録拠点",   request.branch?.name ?? "—"],
            ].map(([label, value]) => (
              <tr key={label}>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                               whitespace-nowrap w-[140px] bg-zinc-50 align-top">
                  {label}
                </th>
                <td className="px-5 py-3 text-sm text-zinc-800">{value}</td>
              </tr>
            ))}

            {/* 依頼内容・条件 */}
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                             whitespace-nowrap bg-zinc-50 align-top">
                依頼内容・条件
              </th>
              <td className="px-5 py-3 text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                {request.description}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* プロジェクト */}
      {request.project && (
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-3 mb-5
                        flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-semibold">関連プロジェクト</span>
          <Link
            href={`/dashboard/projects/${request.project.id}`}
            className="text-sm text-violet-600 hover:underline flex items-center gap-1"
          >
            {request.project.title}
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
            className="text-sm text-violet-600 hover:underline flex items-center gap-1"
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

      {/* ステータス更新・回答入力フォーム */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <p className="text-sm font-semibold text-zinc-700 mb-4">ステータス更新・回答</p>
        <StatusUpdateForm
          requestId={request.id}
          currentStatus={request.status}
          currentReplyNote={request.replyNote}
        />
      </div>

      {/* やり取り・回答 表示（入力済みの場合） */}
      {request.replyNote && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-5 py-4 mt-4">
          <p className="text-xs font-semibold text-zinc-500 mb-2">現在の回答メモ</p>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
            {request.replyNote}
          </p>
        </div>
      )}
    </div>
  );
}
