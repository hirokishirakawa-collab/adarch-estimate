"use client";

import { useState } from "react";
import { AlertTriangle, Ban, Filter } from "lucide-react";

// ------------------------------------------------------------------
// 型定義
// ------------------------------------------------------------------

type PartnerStatusType =
  | "ACTIVE"
  | "INACTIVE"
  | "FORCED_INACTIVE"
  | "NOT_SELECTED";

interface PartnerRow {
  id: string;
  groupCompanyId: string;
  year: number;
  month: number;
  status: PartnerStatusType;
  selectedAt: string | null;
  reportCount: number;
  note: string | null;
  consecutiveInactiveMonths: number;
  groupCompany: {
    id: string;
    name: string;
    ownerName: string;
  };
  score: number | null;
  lastReportDate: string | null;
}

interface AlertBadge {
  type: "warning" | "danger" | "critical";
  label: string;
  count: number;
}

interface Props {
  partners: PartnerRow[];
  alerts: AlertBadge[];
}

// ------------------------------------------------------------------
// 定数
// ------------------------------------------------------------------

const STATUS_LABEL: Record<PartnerStatusType, string> = {
  ACTIVE: "稼働中",
  INACTIVE: "活動休止中",
  FORCED_INACTIVE: "強制休止",
  NOT_SELECTED: "未選択",
};

const STATUS_BADGE: Record<PartnerStatusType, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-amber-50 text-amber-700 border-amber-200",
  FORCED_INACTIVE: "bg-red-50 text-red-700 border-red-200",
  NOT_SELECTED: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const ALERT_STYLE: Record<string, string> = {
  warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
  danger: "bg-red-50 text-red-800 border-red-200",
  critical: "bg-red-100 text-red-900 border-red-300",
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "すべて" },
  { value: "ACTIVE", label: "稼働中" },
  { value: "INACTIVE", label: "活動休止中" },
  { value: "FORCED_INACTIVE", label: "強制休止" },
  { value: "NOT_SELECTED", label: "未選択" },
];

// ------------------------------------------------------------------
// コンポーネント
// ------------------------------------------------------------------

export function PartnerStatusTable({ partners, alerts }: Props) {
  const [filter, setFilter] = useState("ALL");

  const filtered =
    filter === "ALL"
      ? partners
      : partners.filter((p) => p.status === filter);

  const fmtDate = (d: string | null) => {
    if (!d) return "---";
    return new Date(d).toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {/* アラートバッジ */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((alert) => (
            <div
              key={alert.label}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${ALERT_STYLE[alert.type]}`}
            >
              {alert.type === "critical" ? (
                <Ban className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              {alert.label}
              <span className="font-bold ml-0.5">{alert.count}社</span>
            </div>
          ))}
        </div>
      )}

      {/* フィルター */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-zinc-400" />
        <div className="flex gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                filter === opt.value
                  ? "bg-zinc-800 text-white border-zinc-800"
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-400 ml-2">
          {filtered.length}社表示
        </span>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[
                  "パートナー名",
                  "代表者",
                  "当月ステータス",
                  "連続休止月数",
                  "当月報告件���",
                  "直近報告日",
                  "精算状態",
                  "スコア",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-zinc-50/50 transition-colors"
                >
                  <td className="px-3 py-2.5 font-medium text-zinc-800 whitespace-nowrap">
                    {p.groupCompany.name}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap">
                    {p.groupCompany.ownerName}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${STATUS_BADGE[p.status]}`}
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {p.consecutiveInactiveMonths > 0 ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          p.consecutiveInactiveMonths >= 3
                            ? "bg-red-50 text-red-700 border-red-200"
                            : p.consecutiveInactiveMonths >= 2
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-yellow-50 text-yellow-700 border-yellow-200"
                        }`}
                      >
                        {p.consecutiveInactiveMonths}ヶ月
                      </span>
                    ) : (
                      <span className="text-zinc-400">---</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`font-medium ${
                        p.reportCount > 0 ? "text-zinc-800" : "text-red-500"
                      }`}
                    >
                      {p.reportCount}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">
                    {fmtDate(p.lastReportDate)}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.status === "ACTIVE" ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        通常
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        保留
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.score !== null ? (
                      <span
                        className={`font-bold ${
                          p.score >= 70
                            ? "text-emerald-600"
                            : p.score >= 40
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {p.score.toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-zinc-400">---</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-12 text-center text-zinc-400"
                  >
                    該当するパートナーがいません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
