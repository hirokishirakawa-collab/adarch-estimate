"use client";

import { Clock } from "lucide-react";

interface LogEntry {
  id: string;
  action: string;
  detail: string | null;
  staffName: string;
  createdAt: Date;
  lead: { name: string };
}

interface Props {
  logs: LogEntry[];
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 30) return `${diffDay}日前`;
  return new Date(date).toLocaleDateString("ja-JP");
}

function formatLogMessage(log: LogEntry): string {
  const { staffName, lead, action, detail } = log;
  switch (action) {
    case "CREATED":
      return `${staffName}さんが「${lead.name}」をリードとして登録しました`;
    case "STATUS_CHANGED":
      return `${staffName}さんが「${lead.name}」の${detail ?? "ステータスを変更しました"}`;
    case "ASSIGNED":
      return `${staffName}さんが「${lead.name}」の${detail ?? "担当者を設定しました"}`;
    case "CONVERTED":
      return `${staffName}さんが「${lead.name}」を顧客に転換しました`;
    default:
      return `${staffName}さんが「${lead.name}」に対して操作しました`;
  }
}

export function LeadActivityFeed({ logs }: Props) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
      <h3 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-zinc-400" />
        最近のアクティビティ
      </h3>
      <ul className="space-y-2">
        {logs.map((log) => (
          <li
            key={log.id}
            className="flex items-start gap-2 text-xs text-zinc-600"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
            <span className="flex-1">{formatLogMessage(log)}</span>
            <span className="text-zinc-400 flex-shrink-0 whitespace-nowrap">
              {formatRelativeTime(log.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
