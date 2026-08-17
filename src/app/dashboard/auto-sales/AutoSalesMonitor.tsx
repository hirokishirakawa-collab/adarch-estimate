"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  SkipForward,
  Eye,
  Filter,
  ExternalLink,
  ArrowRight,
  MessageSquare,
  UserPlus,
  Save,
} from "lucide-react";

// ステータスの表示設定
const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  QUEUED: {
    label: "待機中",
    icon: Clock,
    color: "text-zinc-500",
    bgColor: "bg-zinc-50",
  },
  PROCESSING: {
    label: "実行中",
    icon: Loader2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  COMPLETED: {
    label: "送信完了",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  FAILED: {
    label: "失敗",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  SKIPPED: {
    label: "スキップ",
    icon: SkipForward,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  DRY_RUN: {
    label: "ドライラン",
    icon: Eye,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
};

// 反響ステータスの選択肢
const RESPONSE_STATUS_OPTIONS = [
  { value: "未対応", label: "未対応" },
  { value: "対応中", label: "対応中" },
  { value: "アポ獲得", label: "アポ獲得" },
  { value: "成約", label: "成約" },
  { value: "失注", label: "失注" },
];

interface Job {
  id: string;
  status: string;
  screenshotUrl: string | null;
  filledData: Record<string, string> | null;
  errorMessage: string | null;
  sentBody: string | null;
  companyInsight: string | null;
  hasResponse: boolean;
  responseNote: string | null;
  responseFrom: string | null;
  responseSubject: string | null;
  responseSnippet: string | null;
  respondedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  target: {
    companyName: string;
    url: string;
    area: string | null;
    industry: string | null;
    branch?: { name: string };
  };
  template: {
    name: string;
    companyName: string;
  };
}

export function AutoSalesMonitor({
  initialJobs,
  branchName,
}: {
  initialJobs: Job[];
  branchName: string;
}) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const filteredJobs =
    filter === "ALL" ? jobs : jobs.filter((j) => j.status === filter);

  const handleJobUpdate = (updatedJob: Partial<Job> & { id: string }) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === updatedJob.id ? { ...j, ...updatedJob } : j))
    );
    if (selectedJob?.id === updatedJob.id) {
      setSelectedJob((prev) => (prev ? { ...prev, ...updatedJob } : null));
    }
  };

  return (
    <div className="space-y-6">
      {/* アクションバー */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/auto-sales/request"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          依頼ページへ
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-zinc-400" />
        {["ALL", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "SKIPPED", "DRY_RUN"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === s
                  ? "bg-zinc-800 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {s === "ALL" ? "すべて" : STATUS_CONFIG[s]?.label ?? s}
              {s !== "ALL" && (
                <span className="ml-1 opacity-60">
                  ({jobs.filter((j) => j.status === s).length})
                </span>
              )}
            </button>
          )
        )}
      </div>

      {/* ジョブリスト */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {filteredJobs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-zinc-400 text-sm">
              {jobs.length === 0
                ? "まだ営業ジョブがありません。営業先を追加してキューに投入してください。"
                : "該当するジョブがありません"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filteredJobs.map((job) => {
              const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.QUEUED;
              const Icon = config.icon;
              const time = job.completedAt ?? job.startedAt ?? job.createdAt;

              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor}`}
                  >
                    <Icon
                      className={`w-4 h-4 ${config.color} ${
                        job.status === "PROCESSING" ? "animate-spin" : ""
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-zinc-900 truncate">
                        {job.target.companyName}
                      </span>
                      {job.hasResponse && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                          反響あり
                        </span>
                      )}
                      {job.target.area && (
                        <span className="text-xs text-zinc-400">
                          {job.target.area}
                        </span>
                      )}
                      {job.target.industry && (
                        <span className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                          {job.target.industry}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {job.template.companyName} → {job.target.url}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-medium ${config.color}`}
                    >
                      {config.label}
                    </span>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {new Date(time).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ジョブ詳細モーダル */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onJobUpdate={handleJobUpdate}
        />
      )}
    </div>
  );
}

// ─── ジョブ詳細モーダル ──────────────────────
function JobDetailModal({
  job,
  onClose,
  onJobUpdate,
}: {
  job: Job;
  onClose: () => void;
  onJobUpdate: (updated: Partial<Job> & { id: string }) => void;
}) {
  const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.QUEUED;
  const Icon = config.icon;

  // 反響記録フォーム
  const currentStatus = extractStatus(job.responseNote);
  const currentNote = extractNote(job.responseNote);
  const [responseStatus, setResponseStatus] = useState(currentStatus);
  const [responseNote, setResponseNote] = useState(currentNote);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 顧客登録
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<string | null>(null);
  const isCustomerRegistered = job.responseNote?.includes("[顧客登録済み:") ?? false;

  const handleSaveResponse = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/auto-sales/jobs/${job.id}/response`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseStatus, responseNote }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveMessage(`エラー: ${data.error ?? "保存に失敗しました"}`);
        return;
      }
      const data = await res.json();
      setSaveMessage("保存しました");
      onJobUpdate({
        id: job.id,
        hasResponse: true,
        responseNote: data.job.responseNote,
        respondedAt: data.job.respondedAt,
      });
    } catch {
      setSaveMessage("エラー: 通信に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterCustomer = async () => {
    setIsRegistering(true);
    setRegisterResult(null);
    try {
      const res = await fetch(
        `/api/auto-sales/jobs/${job.id}/register-customer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setRegisterResult(`エラー: ${data.error ?? "登録に失敗しました"}`);
        return;
      }
      const data = await res.json();
      if (data.alreadyExisted) {
        setRegisterResult(`既存の顧客「${data.customerName}」にリンクしました`);
      } else {
        setRegisterResult(`顧客「${data.customerName}」を登録しました`);
      }
      // responseNote を更新してUIに反映
      onJobUpdate({
        id: job.id,
        responseNote: job.responseNote
          ? `${job.responseNote}\n[顧客登録済み: ${data.customerId}]`
          : `[顧客登録済み: ${data.customerId}]`,
      });
    } catch {
      setRegisterResult("エラー: 通信に失敗しました");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor}`}
          >
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              {job.target.companyName}
            </h2>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${config.color}`}>
                {config.label}
              </span>
              {job.hasResponse && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                  反響あり
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <DetailRow label="URL">
            <a
              href={job.target.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm flex items-center gap-1"
            >
              {job.target.url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </DetailRow>
          {job.target.area && <DetailRow label="エリア">{job.target.area}</DetailRow>}
          {job.target.industry && <DetailRow label="業種">{job.target.industry}</DetailRow>}
          <DetailRow label="テンプレート">
            {job.template.name}（{job.template.companyName}）
          </DetailRow>
          <DetailRow label="作成日時">
            {new Date(job.createdAt).toLocaleString("ja-JP")}
          </DetailRow>
          {job.startedAt && (
            <DetailRow label="開始日時">
              {new Date(job.startedAt).toLocaleString("ja-JP")}
            </DetailRow>
          )}
          {job.completedAt && (
            <DetailRow label="完了日時">
              {new Date(job.completedAt).toLocaleString("ja-JP")}
            </DetailRow>
          )}

          {/* 反響情報 */}
          {job.hasResponse && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-xs font-medium text-emerald-700 mb-2 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                反響情報
              </p>
              {job.responseFrom && (
                <p className="text-xs text-emerald-600">
                  返信元: {job.responseFrom}
                </p>
              )}
              {job.responseSubject && (
                <p className="text-xs text-emerald-600">
                  件名: {job.responseSubject}
                </p>
              )}
              {job.respondedAt && (
                <p className="text-xs text-emerald-600">
                  反響日時: {new Date(job.respondedAt).toLocaleString("ja-JP")}
                </p>
              )}
              {job.responseSnippet && (
                <div className="mt-2 pt-2 border-t border-emerald-200">
                  <p className="text-[11px] font-medium text-emerald-700 mb-1">返信内容</p>
                  <p className="text-xs text-emerald-800 whitespace-pre-wrap leading-relaxed">
                    {job.responseSnippet}
                  </p>
                </div>
              )}
              {job.responseNote && (
                <div className="mt-2 pt-2 border-t border-emerald-200">
                  <p className="text-[11px] font-medium text-emerald-700 mb-1">メモ</p>
                  <p className="text-xs text-emerald-800 whitespace-pre-wrap leading-relaxed">
                    {job.responseNote}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 送信した本文。相手に実際に届いた文章そのもの。 */}
          {job.sentBody && (
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-500 mb-2">
                送信した本文
              </p>
              {job.companyInsight && (
                <p className="text-[11px] text-purple-600 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 mb-2">
                  AIが相手サイトから読み取った一言: 「{job.companyInsight}」
                </p>
              )}
              <div className="bg-white border border-zinc-200 rounded-lg p-3">
                <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                  {job.sentBody}
                </p>
              </div>
            </div>
          )}

          {/* 入力データ */}
          {job.filledData && (
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-500 mb-2">
                入力データ
              </p>
              <div className="bg-zinc-50 rounded-lg p-3 space-y-1">
                {Object.entries(job.filledData).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="text-zinc-400 min-w-[80px]">{key}:</span>
                    <span className="text-zinc-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* スクリーンショット */}
          {job.screenshotUrl && (
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-500 mb-2">
                送信前スクリーンショット
              </p>
              <img
                src={job.screenshotUrl}
                alt="Screenshot"
                className="w-full rounded-lg border border-zinc-200"
              />
            </div>
          )}

          {/* エラーメッセージ */}
          {job.errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-medium text-red-700 mb-1">
                エラー
              </p>
              <p className="text-xs text-red-600">{job.errorMessage}</p>
            </div>
          )}

          {/* ─── 反響を記録セクション ─── */}
          <div className="mt-6 pt-4 border-t border-zinc-200">
            <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              反響を記録
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">
                  対応ステータス
                </label>
                <select
                  value={responseStatus}
                  onChange={(e) => setResponseStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-zinc-900"
                >
                  {RESPONSE_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">
                  メモ
                </label>
                <textarea
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                  placeholder="反響内容やフォローアップ情報を記入..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none text-zinc-900 placeholder:text-zinc-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveResponse}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  保存
                </button>
                {saveMessage && (
                  <span
                    className={`text-xs ${
                      saveMessage.startsWith("エラー")
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {saveMessage}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ─── 顧客として登録ボタン ─── */}
          {job.hasResponse && (
            <div className="mt-4 pt-4 border-t border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                顧客登録
              </h3>
              {isCustomerRegistered ? (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-700 font-medium">
                    登録済み
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleRegisterCustomer}
                    disabled={isRegistering}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isRegistering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    顧客として登録
                  </button>
                  {registerResult && (
                    <p
                      className={`text-xs ${
                        registerResult.startsWith("エラー")
                          ? "text-red-600"
                          : "text-blue-600"
                      }`}
                    >
                      {registerResult}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ヘルパー: responseNote から [STATUS] プレフィクスを抽出 ───
function extractStatus(note: string | null): string {
  if (!note) return "未対応";
  const match = note.match(/^\[(.+?)\]/);
  if (!match) return "未対応";
  const status = match[1];
  if (RESPONSE_STATUS_OPTIONS.some((o) => o.value === status)) return status;
  return "未対応";
}

function extractNote(note: string | null): string {
  if (!note) return "";
  // [STATUS] を除去し、[顧客登録済み: ...] も除去
  return note
    .replace(/^\[.+?\]\s*/, "")
    .replace(/\n?\[顧客登録済み:.*?\]/g, "")
    .trim();
}

// ─── 共通パーツ ─────────────────────────────
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-zinc-400 min-w-[80px] pt-0.5">{label}</span>
      <div className="text-sm text-zinc-700">{children}</div>
    </div>
  );
}
