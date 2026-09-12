"use client";

// 広告グループごとの商圏（本部）。TVerでエリアを設定する単位＝ベンチマークの1件。
//   市区町村を複数チェック→合算人口。手で選んだものは再取込でも保持

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAdGroupAreas } from "@/lib/actions/tver-delivery";
import { AreaPicker } from "@/components/tver/area-picker";

export type AdGroupRow = {
  adGroupName: string; campaignName: string; areaLabel: string | null; areaPopulation: number | null; areaSource: string | null; areaKeys: string[];
  impressions: number; completes: number; clicks: number; sellAmount: number; wholesaleAmount: number;
  options: { key: string; label: string; population: number }[];
};
const SRC: Record<string, string> = { NAME: "名前から自動", ORDER: "申込から自動", PREV: "前回を引き継ぎ", PREF: "県全域（自動）", MANUAL: "本部が選択" };
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const num = (n: number) => n.toLocaleString("ja-JP");

export function AdGroupAreas({ reportId, groups }: { reportId: string; groups: AdGroupRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Set<string>>(new Set());
  return (
    <section className="bg-white border-2 border-emerald-500 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-zinc-900 mb-1">広告グループ別の商圏（TVerでエリアを設定する単位＝ベンチマークの1件）</h2>
      <p className="text-xs text-zinc-500 mb-3">名前に市区町村名があれば自動で入ります（例: TV-2026-0042_久留米市_15s）。違っていれば「選び直す」でTVerの「地域」欄をコピーして貼り付けるか、市区町村を複数チェックしてください（人口は合算）。選んだものは再取込でも変わりません。</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await updateAdGroupAreas(reportId, fd);
            setMsg(r.error ? `⚠️ ${r.error}` : r.message ?? "保存しました");
            setEditing(new Set());
            router.refresh();
          });
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr><th className="text-left py-1">広告グループ</th><th className="text-left py-1">商圏（人口）</th><th className="text-left py-1">出どころ</th><th className="text-right py-1">表示回数</th><th className="text-right py-1">100%再生</th><th className="text-right py-1">卸値</th><th className="text-right py-1">売価</th><th className="text-left py-1 pl-2">商圏</th></tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.adGroupName}>
                <tr className="border-t border-zinc-100 align-top">
                  <td className="py-1.5 pr-2"><div className="text-zinc-900">{g.adGroupName}</div><div className="text-[11px] text-zinc-400">{g.campaignName}</div></td>
                  <td className="py-1.5 pr-2 max-w-[16rem]">{g.areaLabel ?? <span className="text-orange-600">未設定</span>}{g.areaPopulation ? <span className="text-xs text-zinc-500">（{num(g.areaPopulation)}人）</span> : null}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap text-xs text-zinc-500">{g.areaSource ? SRC[g.areaSource] ?? g.areaSource : "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{num(g.impressions)}</td>
                  <td className="py-1.5 text-right tabular-nums">{num(g.completes)}</td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-500">{yen(g.wholesaleAmount)}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{yen(g.sellAmount)}</td>
                  <td className="py-1.5 pl-2 whitespace-nowrap">
                    {editing.has(g.adGroupName) ? (
                      <span className="text-xs text-orange-700">下で選択中</span>
                    ) : (
                      <button type="button" onClick={() => setEditing((s) => new Set(s).add(g.adGroupName))} className="px-2.5 py-1 rounded-md border border-zinc-300 text-xs text-zinc-700 hover:bg-zinc-50">選び直す</button>
                    )}
                  </td>
                </tr>
                {editing.has(g.adGroupName) && (
                  <tr className="bg-orange-50/40">
                    <td colSpan={8} className="py-2 px-2">
                      <div className="text-xs text-zinc-600 mb-1">「{g.adGroupName}」の商圏＝TVerの地域を貼り付け、または市区町村を複数チェック（人口は合算）</div>
                      <AreaPicker name={`area:${g.adGroupName}`} options={g.options} initial={g.areaKeys} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button disabled={pending || editing.size === 0} className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm disabled:opacity-50">商圏を保存</button>
          {msg && <span className="text-sm text-zinc-700">{msg}</span>}
          {editing.size === 0 && !msg && <span className="text-xs text-zinc-400">「選び直す」を押した行だけが保存されます</span>}
        </div>
      </form>
    </section>
  );
}
