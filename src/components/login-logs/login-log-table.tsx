"use client";

import { cn } from "@/lib/utils";

interface LoginLog {
  id: string;
  email: string;
  name: string | null;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface Props {
  logs: LoginLog[];
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortenUA(ua: string | null): string {
  if (!ua) return "-";
  // ブラウザ名を簡略表示
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return ua.slice(0, 30) + (ua.length > 30 ? "..." : "");
}

const REASON_LABELS: Record<string, string> = {
  domain_rejected: "ドメイン拒否",
};

export function LoginLogTable({ logs }: Props) {
  if (logs.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/60">
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                日時
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                メールアドレス
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                名前
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                結果
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                理由
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                IP
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                ブラウザ
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors"
              >
                <td className="px-4 py-2.5 text-zinc-600 whitespace-nowrap">
                  {formatDate(log.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-zinc-900 font-medium">
                  {log.email}
                </td>
                <td className="px-4 py-2.5 text-zinc-600">
                  {log.name ?? "-"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold",
                      log.success
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200",
                    )}
                  >
                    {log.success ? "成功" : "失敗"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-500">
                  {log.reason
                    ? REASON_LABELS[log.reason] ?? log.reason
                    : "-"}
                </td>
                <td className="px-4 py-2.5 text-zinc-500 font-mono text-[11px]">
                  {log.ipAddress ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-zinc-500">
                  {shortenUA(log.userAgent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
