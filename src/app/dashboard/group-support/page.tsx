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
        <h1 className="text-lg font-bold text-white">グループサポート</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{weekId}</p>
      </div>

      {/* ステータスサマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(
          Object.entries(STATUS_CONFIG) as [
            WeeklyStatus,
            (typeof STATUS_CONFIG)[WeeklyStatus],
          ][]
        ).map(([key, cfg]) => (
          <div
            key={key}
            className={`rounded-lg border p-3 ${cfg.bgColor}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{cfg.emoji}</span>
              <span className={`text-xs font-medium ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${cfg.color}`}>
              {counts[key]}
            </p>
          </div>
        ))}
      </div>

      {/* テーブル */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left px-3 py-2 text-zinc-400 font-medium">
                  会社名
                </th>
                <th className="text-left px-3 py-2 text-zinc-400 font-medium">
                  代表
                </th>
                <th className="text-left px-3 py-2 text-zinc-400 font-medium">
                  フェーズ
                </th>
                <th className="text-center px-3 py-2 text-zinc-400 font-medium">
                  今週
                </th>
                <th className="text-left px-3 py-2 text-zinc-400 font-medium">
                  最終共有
                </th>
                <th className="text-left px-3 py-2 text-zinc-400 font-medium">
                  最終コンタクト
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {rows.map((row) => {
                const sCfg = STATUS_CONFIG[row.currentStatus];
                const pOpt = PHASE_OPTIONS.find(
                  (p) => p.value === row.phase
                );
                const lastSub = row.weeklySubmissions[0];
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/group-support/${row.id}`}
                        className="text-blue-400 hover:underline font-medium"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {row.ownerName}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {pOpt?.label ?? row.phase}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${sCfg.bgColor} ${sCfg.color}`}
                      >
                        {sCfg.emoji} {sCfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {fmt(lastSub?.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {fmt(row.lastContact)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-zinc-500"
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
