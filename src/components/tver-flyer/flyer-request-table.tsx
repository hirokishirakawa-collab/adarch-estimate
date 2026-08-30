import Link from "next/link";
import { FileDown } from "lucide-react";
import { TVER_FLYER_STATUS_OPTIONS, getFlyerStatusOption } from "@/lib/constants/tver-flyer";
import type { UserRole } from "@/types/roles";

type Row = {
  id: string;
  prefName: string;
  areaLabel: string;
  clientName: string | null;
  industry: string | null;
  status: string;
  createdAt: Date;
  deliveredAt: Date | null;
  createdBy: { name: string | null } | null;
  branch: { name: string } | null;
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(d));
}

export function FlyerRequestTable({ requests, role }: { requests: Row[]; role: UserRole }) {
  const isAdmin = role === "ADMIN";
  const counts = TVER_FLYER_STATUS_OPTIONS.map((o) => ({ ...o, count: requests.filter((r) => r.status === o.value).length }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {counts.map(({ label, className, count }) => (
          <div key={label} className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
            <p className="text-[11px] text-zinc-500 font-semibold mb-0.5">{label}</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-zinc-800">{count}</p>
              <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full border ${className}`}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["商圏", "クライアント", "業種", ...(isAdmin ? ["拠点", "依頼者"] : []), "ステータス", "依頼日", "納品日", ""].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {requests.map((r) => {
                const st = getFlyerStatusOption(r.status);
                return (
                  <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/dashboard/tver-flyer/${r.id}`} className="text-sm font-semibold text-zinc-800 hover:text-blue-700 hover:underline">
                        {r.areaLabel}
                      </Link>
                      <span className="block text-[11px] text-zinc-400">{r.prefName}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 max-w-[160px] truncate">{r.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">{r.industry ?? "—"}</td>
                    {isAdmin && <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">{r.branch?.name ?? "—"}</td>}
                    {isAdmin && <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">{r.createdBy?.name ?? "—"}</td>}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${st.className}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(r.deliveredAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {r.status === "DELIVERED" && (
                        <a href={`/api/tver-flyer/${r.id}/pdf?dl=1`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <FileDown className="w-3.5 h-3.5" />PDF
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="px-4 py-10 text-center text-sm text-zinc-400">
                    まだ依頼はありません。「新規依頼」から商圏を選んでください。
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
