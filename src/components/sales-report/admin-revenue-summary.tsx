import { BarChart2 } from "lucide-react";

type ReportWithUser = {
  id: string;
  amount: { toString(): string };
  targetMonth: Date;
  createdBy: { name: string | null; email: string };
};

interface Props {
  reports: ReportWithUser[];
}

function fmtAmount(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function fmtMonth(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(new Date(d));
}

export function AdminRevenueSummary({ reports }: Props) {
  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth();

  // 今月の全体合計
  const thisMonthTotal = reports
    .filter((r) => {
      const d = new Date(r.targetMonth);
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    })
    .reduce((sum, r) => sum + Number(r.amount), 0);

  // 今年度の全体合計（4月始まり）
  const fiscalStart = thisMonth >= 3 ? thisYear : thisYear - 1;
  const yearTotal = reports
    .filter((r) => {
      const d = new Date(r.targetMonth);
      const y = d.getFullYear();
      const m = d.getMonth();
      return (y > fiscalStart || (y === fiscalStart && m >= 3)) &&
             (y < fiscalStart + 1 || (y === fiscalStart + 1 && m < 3));
    })
    .reduce((sum, r) => sum + Number(r.amount), 0);

  // メンバー別合計（今年度）
  const memberMap = new Map<string, { name: string; total: number }>();
  for (const r of reports) {
    const d = new Date(r.targetMonth);
    const y = d.getFullYear();
    const m = d.getMonth();
    const inFiscal =
      (y > fiscalStart || (y === fiscalStart && m >= 3)) &&
      (y < fiscalStart + 1 || (y === fiscalStart + 1 && m < 3));
    if (!inFiscal) continue;

    const key = r.createdBy.email;
    const name = r.createdBy.name ?? r.createdBy.email;
    const cur = memberMap.get(key) ?? { name, total: 0 };
    memberMap.set(key, { name, total: cur.total + Number(r.amount) });
  }
  const members = [...memberMap.entries()]
    .map(([, v]) => v)
    .sort((a, b) => b.total - a.total);

  // 直近6ヶ月の月別合計
  const monthlyMap = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthlyMap.set(key, 0);
  }
  for (const r of reports) {
    const d = new Date(r.targetMonth);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthlyMap.has(key)) {
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(r.amount));
    }
  }
  const monthly = [...monthlyMap.entries()].map(([key, total]) => {
    const [y, m] = key.split("-").map(Number);
    return { label: fmtMonth(new Date(y, m, 1)), total };
  });
  const maxMonthly = Math.max(...monthly.map((m) => m.total), 1);

  const thisMonthLabel = fmtMonth(now);

  return (
    <div className="space-y-4">
      {/* 管理者ヘッダー */}
      <div className="flex items-center gap-2 px-1">
        <BarChart2 className="w-4 h-4 text-amber-500" />
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          管理者集計ビュー（全メンバー）
        </p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl px-5 py-4">
          <p className="text-[11px] text-amber-600 font-semibold mb-1">{thisMonthLabel}（全体）</p>
          <p className="text-2xl font-bold text-amber-900">{fmtAmount(thisMonthTotal)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-5 py-4">
          <p className="text-[11px] text-blue-600 font-semibold mb-1">
            {fiscalStart}年度 累計（全体）
          </p>
          <p className="text-2xl font-bold text-blue-900">{fmtAmount(yearTotal)}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
          <p className="text-[11px] text-zinc-500 font-semibold mb-1">総報告件数</p>
          <p className="text-2xl font-bold text-zinc-800">{reports.length}<span className="text-sm font-normal ml-1">件</span></p>
        </div>
      </div>

      {/* メンバー別 + 月別グラフ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* メンバー別合計（今年度） */}
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-zinc-600 mb-3">
            メンバー別合計（{fiscalStart}年度）
          </p>
          {members.length === 0 ? (
            <p className="text-xs text-zinc-400">データなし</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.name}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-zinc-600 truncate max-w-[140px]">{m.name}</span>
                    <span className="font-semibold text-zinc-800 tabular-nums">{fmtAmount(m.total)}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(m.total / yearTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 直近6ヶ月の月別推移 */}
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-zinc-600 mb-3">月別推移（直近6ヶ月）</p>
          <div className="space-y-2">
            {monthly.map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-zinc-500">{m.label}</span>
                  <span className="font-semibold text-zinc-800 tabular-nums">
                    {m.total > 0 ? fmtAmount(m.total) : "—"}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: `${(m.total / maxMonthly) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
