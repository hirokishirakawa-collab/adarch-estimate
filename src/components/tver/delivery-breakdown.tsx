// TVer配信実績 — 内訳テーブル（本部・拠点で共用）。売価だけを扱い、卸値は受け取らない

import type { Breakdown } from "@/lib/tver/delivery-csv";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

function Table({ title, rows, keyLabel, showAmount, border = "border border-zinc-200" }: { title: string; rows: Breakdown[]; keyLabel: string; showAmount: boolean; border?: string }) {
  return (
    <section className={`bg-white ${border} rounded-xl p-5`}>
      <h2 className="text-sm font-semibold text-zinc-900 mb-3">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="text-left py-1">{keyLabel}</th>
              <th className="text-right py-1">表示回数</th>
              <th className="text-right py-1">100%再生</th>
              <th className="text-right py-1">クリック</th>
              {showAmount && <th className="text-right py-1">金額（税抜）</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.key} className="border-t border-zinc-100">
                <td className="py-1.5 pr-2 whitespace-nowrap">{b.key}</td>
                <td className="py-1.5 text-right tabular-nums">{b.impressions.toLocaleString("ja-JP")}</td>
                <td className="py-1.5 text-right tabular-nums">{b.completes.toLocaleString("ja-JP")}</td>
                <td className="py-1.5 text-right tabular-nums">{b.clicks.toLocaleString("ja-JP")}</td>
                {showAmount && <td className="py-1.5 text-right tabular-nums">{yen(b.sellAmount)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BreakdownTables({ byPref, byDevice, byDate, byAge, showAmount = true, border }: { byPref: Breakdown[]; byDevice: Breakdown[]; byDate: Breakdown[]; byAge: Breakdown[]; showAmount?: boolean; border?: string }) {
  return (
    <>
      <Table title="都道府県別" rows={byPref} keyLabel="都道府県" showAmount={showAmount} border={border} />
      <div className="grid md:grid-cols-2 gap-6">
        <Table title="デバイス別" rows={byDevice} keyLabel="デバイス" showAmount={false} border={border} />
        <Table title="性別・年齢別" rows={byAge} keyLabel="性別 年齢" showAmount={false} border={border} />
      </div>
      <Table title="日別" rows={byDate} keyLabel="日付" showAmount={showAmount} border={border} />
    </>
  );
}
