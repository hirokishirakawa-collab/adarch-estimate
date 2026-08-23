import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { getOutreachFunnelBoard, currentMonthKey } from "@/lib/kpis/outreach-funnel";
import type { UserRole } from "@/types/roles";

// ---------------------------------------------------------------
// 行動量ボード（本部のみ）
//   送付 → 返信あり → 受注 → 報告済売上 を加盟会社ごとに並べる。
//   全体定例で映す前提。個社の評価は数字で語る。
// ---------------------------------------------------------------

function pct(n: number, d: number): string {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}
function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return currentMonthKey(d);
}

export default async function FunnelBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  const role = (session?.user?.role ?? "MANAGER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard/sales-report");

  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? (params.month as string) : currentMonthKey();
  const board = await getOutreachFunnelBoard(month);
  const [y, m] = month.split("-");

  const cols = "grid grid-cols-[minmax(160px,1.6fr)_repeat(3,minmax(70px,1fr))_minmax(70px,1fr)_minmax(110px,1.2fr)]";

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Activity className="text-emerald-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">行動量ボード</h2>
            <p className="text-xs text-zinc-500 mt-0.5">送付 → 返信あり → 受注 → 報告済売上（加盟会社別）</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`?month=${shiftMonth(month, -1)}`} className="px-2 py-1 text-xs border border-zinc-200 rounded-lg hover:bg-zinc-50">←</Link>
          <span className="text-sm font-semibold text-zinc-800 tabular-nums">{y}年{Number(m)}月</span>
          <Link href={`?month=${shiftMonth(month, 1)}`} className="px-2 py-1 text-xs border border-zinc-200 rounded-lg hover:bg-zinc-50">→</Link>
          <Link href="/dashboard/sales-report" className="ml-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
            <ArrowLeft className="w-3.5 h-3.5" />月次報告へ
          </Link>
        </div>
      </div>

      {/* 合計 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "送付", value: String(board.total.sent), sub: "営業フォーム送付数" },
          { label: "返信あり", value: String(board.total.replied), sub: `送付比 ${pct(board.total.replied, board.total.sent)}` },
          { label: "受注", value: String(board.total.won), sub: `返信比 ${pct(board.total.won, board.total.replied)}` },
          { label: "報告済売上", value: yen(board.total.reportedAmount), sub: `${board.total.reportCount}件の報告・税抜` },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-[11px] text-zinc-500">{c.label}</p>
            <p className="text-xl font-bold text-zinc-900 tabular-nums leading-tight mt-0.5">{c.value}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 会社別 */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        <div className={`${cols} gap-2 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-500 min-w-[640px]`}>
          <span>加盟会社</span>
          <span className="text-right">送付</span>
          <span className="text-right">返信あり</span>
          <span className="text-right">受注</span>
          <span className="text-right">報告</span>
          <span className="text-right">報告済売上</span>
        </div>
        {board.rows.map((r) => {
          const idle = r.sent === 0 && r.replied === 0 && r.won === 0 && r.reportCount === 0;
          return (
            <div
              key={r.key}
              className={`${cols} gap-2 px-4 py-2.5 border-b border-zinc-100 text-sm min-w-[640px] ${idle ? "text-zinc-400" : "text-zinc-800"}`}
            >
              <span className="truncate font-medium">
                {r.companyName}
                {idle && <span className="ml-2 text-[10px] text-rose-500 font-semibold">動きなし</span>}
              </span>
              <span className="text-right tabular-nums">{r.sent}</span>
              <span className="text-right tabular-nums">
                {r.replied}
                <span className="ml-1 text-[10px] text-zinc-400">{pct(r.replied, r.sent)}</span>
              </span>
              <span className="text-right tabular-nums">{r.won}</span>
              <span className="text-right tabular-nums">{r.reportCount ? "済" : "未"}</span>
              <span className="text-right tabular-nums">{yen(r.reportedAmount)}</span>
            </div>
          );
        })}
        {board.rows.length === 0 && (
          <p className="px-4 py-6 text-sm text-zinc-400 text-center">この月のデータはありません</p>
        )}
      </div>

      <p className="text-[11px] text-zinc-400 leading-relaxed">
        送付＝営業フォームで送付済みにした件数／返信あり＝結果ボタン「返信あり」「受注」／受注＝結果ボタン「受注」／報告済売上＝その月の月次報告の合計（税抜）。
        名前を変えた方の送付は加盟会社に紐づかず「加盟会社に紐づかない操作」に入ります。
      </p>
    </div>
  );
}
