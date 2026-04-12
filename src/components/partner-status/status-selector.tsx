"use client";

import { useState, useCallback } from "react";
import {
  Activity,
  Pause,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Briefcase,
  Wrench,
  Users,
  Ban,
  Clock,
  Wallet,
} from "lucide-react";

// ------------------------------------------------------------------
// 型定義
// ------------------------------------------------------------------

type PartnerStatusType =
  | "ACTIVE"
  | "INACTIVE"
  | "FORCED_INACTIVE"
  | "NOT_SELECTED";

interface StatusRecord {
  id: string;
  groupCompanyId: string;
  year: number;
  month: number;
  status: PartnerStatusType;
  selectedAt: string | null;
  reportCount: number;
  note: string | null;
  groupCompany?: { name: string; ownerName: string };
}

interface LogRecord {
  id: string;
  fromStatus: PartnerStatusType;
  toStatus: PartnerStatusType;
  reason: string;
  changedBy: string;
  createdAt: string;
}

interface Props {
  initialStatus: StatusRecord | null;
  logs: LogRecord[];
  companyName: string;
}

// ------------------------------------------------------------------
// ラベルマップ
// ------------------------------------------------------------------

const STATUS_LABEL: Record<PartnerStatusType, string> = {
  ACTIVE: "稼働中",
  INACTIVE: "活動休止中",
  FORCED_INACTIVE: "強制休止",
  NOT_SELECTED: "未選択",
};

const STATUS_COLOR: Record<PartnerStatusType, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-amber-50 text-amber-700 border-amber-200",
  FORCED_INACTIVE: "bg-red-50 text-red-700 border-red-200",
  NOT_SELECTED: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

// ------------------------------------------------------------------
// コンポーネント
// ------------------------------------------------------------------

export function PartnerStatusSelector({
  initialStatus,
  logs,
  companyName,
}: Props) {
  const [current, setCurrent] = useState<StatusRecord | null>(initialStatus);
  const [selected, setSelected] = useState<"ACTIVE" | "INACTIVE" | null>(null);
  const [note, setNote] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logList, setLogList] = useState<LogRecord[]>(logs);

  const currentStatus = current?.status ?? "NOT_SELECTED";

  const handleSubmit = useCallback(async () => {
    if (!selected) return;
    setIsPending(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/partner-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selected,
          note: selected === "INACTIVE" ? note : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "エラーが発生しました");
      }

      const data = await res.json();
      setCurrent(data.status);
      setSuccess(true);
      setSelected(null);
      setNote("");

      // ログ再取得
      const logRes = await fetch("/api/partner-status");
      if (logRes.ok) {
        // ログは server component で渡したものを更新（簡易的にリロードで対応）
        // ここでは成功表示後にページ内容を更新
      }

      // 成功メッセージを3秒後に消す
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsPending(false);
    }
  }, [selected, note]);

  const now = new Date();
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;

  return (
    <div className="space-y-6">
      {/* 月と現在ステータス */}
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
        <p className="text-xs text-zinc-500 mb-1">対象月</p>
        <p className="text-2xl font-bold text-zinc-900">{monthLabel}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-zinc-500">現在のステータス:</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${STATUS_COLOR[currentStatus]}`}
          >
            {STATUS_LABEL[currentStatus]}
          </span>
        </div>
        {companyName && (
          <p className="text-xs text-zinc-400 mt-1">{companyName}</p>
        )}
      </div>

      {/* ステータス選択カード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 稼働中カード */}
        <button
          type="button"
          onClick={() => setSelected("ACTIVE")}
          disabled={isPending}
          className={`text-left rounded-xl border-2 p-5 transition-all ${
            selected === "ACTIVE"
              ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
              : currentStatus === "ACTIVE"
                ? "border-emerald-300 bg-emerald-50/50"
                : "border-zinc-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
          } disabled:opacity-60`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-bold text-zinc-900">稼働中</p>
              <p className="text-xs text-emerald-600 font-medium">ACTIVE</p>
            </div>
            {selected === "ACTIVE" && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 ml-auto" />
            )}
          </div>
          <div className="space-y-2 text-xs text-zinc-600">
            <div className="flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>案件紹介を受けられます</span>
            </div>
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>全ツールをご利用いただけます</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>グループ連携に参加できます</span>
            </div>
          </div>
        </button>

        {/* 活動休止中カード */}
        <button
          type="button"
          onClick={() => setSelected("INACTIVE")}
          disabled={isPending}
          className={`text-left rounded-xl border-2 p-5 transition-all ${
            selected === "INACTIVE"
              ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
              : currentStatus === "INACTIVE"
                ? "border-amber-300 bg-amber-50/50"
                : "border-zinc-200 bg-white hover:border-amber-300 hover:bg-amber-50/30"
          } disabled:opacity-60`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Pause className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-base font-bold text-zinc-900">活動休止中</p>
              <p className="text-xs text-amber-600 font-medium">INACTIVE</p>
            </div>
            {selected === "INACTIVE" && (
              <CheckCircle2 className="w-5 h-5 text-amber-600 ml-auto" />
            )}
          </div>
          <div className="space-y-2 text-xs text-zinc-600">
            <div className="flex items-center gap-2">
              <Ban className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span>OS機能が停止されます</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span>3ヶ月継続で解除検討対象になります</span>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span>マネジメント料は引き続き発生します</span>
            </div>
          </div>
        </button>
      </div>

      {/* 活動休止中の理由入力 */}
      {selected === "INACTIVE" && (
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            休止の理由（任意）
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="例: 自社案件対応中のため一時休止"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>
      )}

      {/* 送信ボタン */}
      {selected && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
              selected === "ACTIVE"
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : "bg-amber-600 text-white hover:bg-amber-500"
            }`}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {selected === "ACTIVE" ? "稼働中に設定" : "活動休止中に設定"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setNote("");
            }}
            className="text-xs text-zinc-500 hover:text-zinc-700"
          >
            キャンセル
          </button>
        </div>
      )}

      {/* フィードバック */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-sm text-emerald-700">
            ステータスを更新しました
          </span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* 変更履歴タイムライン */}
      {logList.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
          <h3 className="text-sm font-bold text-zinc-900 mb-3">変更履歴</h3>
          <div className="space-y-3">
            {logList.map((log) => {
              const date = new Date(log.createdAt);
              const dateStr = date.toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
              const timeStr = date.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 text-xs"
                >
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-zinc-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${STATUS_COLOR[log.fromStatus]}`}
                      >
                        {STATUS_LABEL[log.fromStatus]}
                      </span>
                      <span className="text-zinc-400">&rarr;</span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${STATUS_COLOR[log.toStatus]}`}
                      >
                        {STATUS_LABEL[log.toStatus]}
                      </span>
                    </div>
                    <p className="text-zinc-500 mt-0.5">
                      {log.reason} / {log.changedBy}
                    </p>
                    <p className="text-zinc-400">
                      {dateStr} {timeStr}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
