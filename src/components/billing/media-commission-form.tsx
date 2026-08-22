"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInvoiceCommission } from "@/lib/actions/billing";

/**
 * 媒体請求の本部手数料を、本部が打ち込むための入力欄（ADMIN のみ表示）。
 *
 * 媒体請求は取引媒体に応じて媒体側へ支払う額が変わるため、申請の時点では率が決まらない。
 * 本部が申請を許可する段階でここに金額を入れる。入れた額はロイヤリティの月次集計に乗る。
 */
export function MediaCommissionForm({
  requestId,
  medias,
  amountExclTax,
  current,
}: {
  requestId: string;
  medias: { name: string; costExclTax: number }[];
  amountExclTax: number;
  current: number | null;
}) {
  const mediaCostTotal = medias.reduce((sum, m) => sum + m.costExclTax, 0);
  const [value, setValue] = useState<string>(current != null ? String(current) : "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    setSaved(false);
    const n = parseInt(value.replace(/,/g, ""), 10);
    if (isNaN(n) || n < 0) {
      setError("手数料は0以上の整数で入力してください");
      return;
    }
    startTransition(async () => {
      const res = await setInvoiceCommission(requestId, n);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const tax = Math.floor((parseInt(value.replace(/,/g, ""), 10) || 0) * 0.1);

  return (
    <div className="bg-white border border-amber-200 rounded-xl px-5 py-4 mb-5">
      <p className="text-xs font-bold text-amber-800">本部手数料の入力（本部のみ）</p>
      <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
        媒体ごとに媒体側へ支払う額が変わるため、下の内訳を見て手数料を打ち込んでください。
        入力した額がロイヤリティの相殺に充当されます。
      </p>

      {medias.length > 0 && (
        <div className="mt-3 rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-1.5 text-left font-semibold text-zinc-600">媒体</th>
                <th className="px-3 py-1.5 text-right font-semibold text-zinc-600">媒体費実費（税抜）</th>
              </tr>
            </thead>
            <tbody>
              {medias.map((m, i) => (
                <tr key={i} className="border-t border-zinc-100">
                  <td className="px-3 py-1.5 text-zinc-700">{m.name}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-700">
                    ¥{m.costExclTax.toLocaleString("ja-JP")}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-zinc-200 bg-zinc-50/60">
                <td className="px-3 py-1.5 font-semibold text-zinc-700">合計</td>
                <td className="px-3 py-1.5 text-right font-bold text-zinc-900">
                  ¥{mediaCostTotal.toLocaleString("ja-JP")}
                </td>
              </tr>
              <tr className="border-t border-zinc-100">
                <td className="px-3 py-1.5 text-zinc-500">請求額（税抜）との差</td>
                <td className="px-3 py-1.5 text-right text-zinc-700">
                  ¥{(amountExclTax - mediaCostTotal).toLocaleString("ja-JP")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">¥</span>
          <input
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="w-40 pl-7 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
        <span className="text-[11px] text-zinc-400">税抜（上限 ¥{amountExclTax.toLocaleString("ja-JP")}）</span>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white
                     hover:bg-amber-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存する"}
        </button>
        {tax > 0 && (
          <span className="text-[11px] text-zinc-500">
            消費税 ¥{tax.toLocaleString("ja-JP")} を加えて控除します
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {saved && !error && <p className="mt-2 text-xs text-emerald-700">保存しました</p>}
    </div>
  );
}
