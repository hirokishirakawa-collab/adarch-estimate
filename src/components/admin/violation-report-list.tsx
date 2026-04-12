"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ------------------------------------------------------------------
// 型定義
// ------------------------------------------------------------------

type ViolationReportStatus =
  | "PENDING"
  | "REVIEWING"
  | "CONFIRMED"
  | "DISMISSED"
  | "RESOLVED";

interface Report {
  id: string;
  reporterCompanyId: string | null;
  isAnonymous: boolean;
  targetDescription: string;
  content: string;
  evidenceUrls: string[];
  status: ViolationReportStatus;
  adminNote: string | null;
  createdAt: string;
  reporterCompany: {
    id: string;
    name: string;
    ownerName: string;
  } | null;
}

interface Props {
  reports: Report[];
}

// ------------------------------------------------------------------
// 定数
// ------------------------------------------------------------------

const STATUS_LABEL: Record<ViolationReportStatus, string> = {
  PENDING: "未対応",
  REVIEWING: "調査中",
  CONFIRMED: "確認済み",
  DISMISSED: "該当なし",
  RESOLVED: "対応済み",
};

const STATUS_BADGE: Record<ViolationReportStatus, string> = {
  PENDING: "bg-red-50 text-red-700 border-red-200",
  REVIEWING: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-orange-50 text-orange-700 border-orange-200",
  DISMISSED: "bg-zinc-100 text-zinc-500 border-zinc-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATUS_OPTIONS: ViolationReportStatus[] = [
  "PENDING",
  "REVIEWING",
  "CONFIRMED",
  "DISMISSED",
  "RESOLVED",
];

// ------------------------------------------------------------------
// 個別レポートカード
// ------------------------------------------------------------------

function ReportCard({
  report,
  onStatusUpdate,
}: {
  report: Report;
  onStatusUpdate: (id: string, status: ViolationReportStatus, note: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newStatus, setNewStatus] = useState<ViolationReportStatus>(report.status);
  const [adminNote, setAdminNote] = useState(report.adminNote ?? "");
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  const handleUpdate = async () => {
    setIsPending(true);
    setFeedback(null);
    try {
      await onStatusUpdate(report.id, newStatus, adminNote);
      setFeedback("success");
      setTimeout(() => setFeedback(null), 2000);
    } catch {
      setFeedback("error");
    } finally {
      setIsPending(false);
    }
  };

  const date = new Date(report.createdAt);
  const dateStr = date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* ヘッダー行 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-400">{dateStr}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${STATUS_BADGE[report.status]}`}
            >
              {STATUS_LABEL[report.status]}
            </span>
            <span className="text-xs text-zinc-500">
              {report.isAnonymous
                ? "匿名"
                : report.reporterCompany?.name ?? "不明"}
            </span>
          </div>
          <p className="text-sm text-zinc-800 mt-1 truncate">
            {report.targetDescription}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        )}
      </button>

      {/* 詳細 */}
      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-4 space-y-4">
          {/* 通報内容 */}
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 mb-1">
              対象の説明
            </p>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">
              {report.targetDescription}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-zinc-500 mb-1">
              詳細内容
            </p>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">
              {report.content}
            </p>
          </div>

          {/* 証拠リンク */}
          {report.evidenceUrls.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-zinc-500 mb-1">
                証拠URL
              </p>
              <div className="space-y-1">
                {report.evidenceUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ADMIN操作 */}
          <div className="border-t border-zinc-100 pt-3 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-500">
              ADMIN操作
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-zinc-600">ステータス:</label>
              <select
                value={newStatus}
                onChange={(e) =>
                  setNewStatus(e.target.value as ViolationReportStatus)
                }
                className="px-2 py-1 text-xs border border-zinc-200 rounded-md bg-white text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-600 mb-1">
                対応メモ:
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
                placeholder="対応内容を記録..."
                className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                更新
              </button>
              {feedback === "success" && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  更新しました
                </span>
              )}
              {feedback === "error" && (
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  エラー
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// メインコンポーネント
// ------------------------------------------------------------------

export function ViolationReportList({ reports: initialReports }: Props) {
  const [reports, setReports] = useState(initialReports);

  const handleStatusUpdate = useCallback(
    async (id: string, status: ViolationReportStatus, adminNote: string) => {
      const res = await fetch(`/api/violation-reports/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "エラーが発生しました");
      }

      // ローカルステートを更新
      setReports((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status, adminNote } : r
        )
      );
    },
    []
  );

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          onStatusUpdate={handleStatusUpdate}
        />
      ))}
      {reports.length === 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-12 text-center">
          <p className="text-sm text-zinc-400">通報はありません</p>
        </div>
      )}
    </div>
  );
}
