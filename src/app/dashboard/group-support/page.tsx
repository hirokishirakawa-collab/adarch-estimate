import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { UserRole } from "@/types/roles";
import { getGroupCompanies } from "@/lib/actions/group-support";
import {
  STATUS_CONFIG,
  PHASE_OPTIONS,
} from "@/lib/constants/group-support";
import type { WeeklyStatus } from "@/generated/prisma/client";

const STATUS_LIGHT: Record<
  WeeklyStatus,
  { color: string; bgColor: string }
> = {
  GREEN: { color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
  YELLOW: { color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200" },
  RED: { color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
  NONE: { color: "text-zinc-500", bgColor: "bg-zinc-50 border-zinc-200" },
};

export default async function GroupSupportPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const { companies, weekId } = await getGroupCompanies();

  // ステータス集計
  const counts: Record<WeeklyStatus, number> = {
    GREEN: 0,
    YELLOW: 0,
    RED: 0,
    NONE: 0,
  };

  const rows = companies.map((c) => {
    const sub = c.weeklySubmissions[0];
    const status: WeeklyStatus = sub?.status ?? "NONE";
    counts[status]++;
    const lastContact = c.contactHistories[0]?.createdAt ?? null;
    return { ...c, currentStatus: status, lastContact };
  });

  const fmt = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("ja-JP", {
          month: "short",
          day: "numeric",
        })
      : "—";

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div>
        <h1 className="text-lg font-bold text-zinc-900">グループサポート</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{weekId}</p>
      </div>

      {/* ステータスサマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(
          Object.entries(STATUS_CONFIG) as [
            WeeklyStatus,
            (typeof STATUS_CONFIG)[WeeklyStatus],
          ][]
        ).map(([key, cfg]) => {
          const light = STATUS_LIGHT[key];
          return (
            <div
              key={key}
              className={`rounded-lg border p-3 ${light.bgColor}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{cfg.emoji}</span>
                <span className={`text-xs font-medium ${light.color}`}>
                  {cfg.label}
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${light.color}`}>
                {counts[key]}
              </p>
            </div>
          );
        })}
      </div>

      {/* テーブル */}
      <div className="rounded-lg border border-zinc-200 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">
                  会社名
                </th>
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">
                  代表
                </th>
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">
                  フェーズ
                </th>
                <th className="text-center px-3 py-2 text-zinc-500 font-medium">
                  今週
                </th>
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">
                  最終共有
                </th>
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">
                  最終コンタクト
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row) => {
                const light = STATUS_LIGHT[row.currentStatus];
                const cfg = STATUS_CONFIG[row.currentStatus];
                const pOpt = PHASE_OPTIONS.find(
                  (p) => p.value === row.phase
                );
                const lastSub = row.weeklySubmissions[0];
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/group-support/${row.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {row.ownerName}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {pOpt?.label ?? row.phase}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${light.bgColor} ${light.color}`}
                      >
                        {cfg.emoji} {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {fmt(lastSub?.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {fmt(row.lastContact)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-zinc-400"
                  >
                    登録企業がありません
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
