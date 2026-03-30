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

interface Job {
  id: string;
  status: string;
  screenshotUrl: string | null;
  filledData: Record<string, string> | null;
  errorMessage: string | null;
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
  const [jobs] = useState<Job[]>(initialJobs);
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const filteredJobs =
    filter === "ALL" ? jobs : jobs.filter((j) => j.status === filter);

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
        <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}

// ─── ジョブ詳細モーダル ──────────────────────
function JobDetailModal({
  job,
  onClose,
}: {
  job: Job;
  onClose: () => void;
}) {
  const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.QUEUED;
  const Icon = config.icon;

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
            <span className={`text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
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
