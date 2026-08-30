"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Sparkles, Eye, PackageCheck } from "lucide-react";
import { updateTverFlyerRequest, generateFlyerCatchCopy } from "@/lib/actions/tver-flyer";
import { TVER_FLYER_STATUS_OPTIONS } from "@/lib/constants/tver-flyer";

export interface AdminPanelProps {
  requestId: string;
  status: string;
  calc: {
    areaLabel: string;
    population: number;
    viewers: number;
    reach: number;
    calcMonthly: number;
    calcTotal: number;
    coveragePct: number;
    coverageBudget: number;
    coverageIsCustom: boolean;
    neighbors: { areaLabel: string; monthly: number }[];
  };
  values: {
    monthlyOverride: number | null;
    totalOverride: number | null;
    catchCopy: string | null;
    issuerName: string | null;
    issuerContact: string | null;
    replyNote: string | null;
  };
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white text-zinc-900";

const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const man = (n: number) => (n >= 10_000 ? `${(n / 10_000).toFixed(1)}万人` : `${Math.round(n).toLocaleString("ja-JP")}人`);

export function FlyerAdminPanel({ requestId, status, calc, values }: AdminPanelProps) {
  const bound = updateTverFlyerRequest.bind(null, requestId);
  const [state, formAction, isPending] = useActionState(bound, null);
  const [catchCopy, setCatchCopy] = useState(values.catchCopy ?? "");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();

  function generate() {
    setAiError(null);
    startAi(async () => {
      const r = await generateFlyerCatchCopy(requestId);
      if (r.error) setAiError(r.error);
      else if (r.text) setCatchCopy(r.text);
    });
  }

  return (
    <div className="space-y-5">
      {/* 計算値 */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <p className="text-sm font-semibold text-zinc-700 mb-3">計算値（資料と同じ式・{calc.areaLabel}）</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["人口", `${calc.population.toLocaleString("ja-JP")}人`],
            ["TVer視聴者（推計）", man(calc.viewers)],
            ["到達人数（3人に1人）", man(calc.reach)],
            [calc.coverageIsCustom ? `予算${yen(calc.coverageBudget)}での到達率` : "100万円での到達率", `${calc.coveragePct.toFixed(1)}%`],
            ["月額 媒体費", yen(calc.calcMonthly)],
            ["3ヶ月 総額", yen(calc.calcTotal)],
          ].map(([l, v]) => (
            <div key={l} className="bg-zinc-50 rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-zinc-500">{l}</p>
              <p className="text-base font-bold text-zinc-800">{v}</p>
            </div>
          ))}
        </div>
        {calc.neighbors.length > 0 && (
          <p className="text-[11px] text-zinc-500 mt-3">
            比較表に載る近隣市: {calc.neighbors.map((n) => `${n.areaLabel} ${yen(n.monthly)}`).join(" ／ ")}
          </p>
        )}
      </div>

      {/* 仕上げフォーム */}
      <form action={formAction} className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <p className="text-sm font-semibold text-zinc-700">本部の仕上げ</p>
        {state?.error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{state.error}</div>}
        {state?.ok && <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">保存しました</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">月額の手直し（円・空欄=計算値）</label>
            <input type="text" name="monthlyOverride" inputMode="numeric" defaultValue={values.monthlyOverride ?? ""} placeholder={String(calc.calcMonthly)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">3ヶ月総額の手直し（円・空欄=計算値）</label>
            <input type="text" name="totalOverride" inputMode="numeric" defaultValue={values.totalOverride ?? ""} placeholder={String(calc.calcTotal)} className={inputCls} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-zinc-700">業種別の一言（チラシ右カラム）</label>
            <button type="button" onClick={generate} disabled={aiPending}
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline disabled:opacity-60">
              {aiPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              AIで下書き
            </button>
          </div>
          <textarea name="catchCopy" rows={3} value={catchCopy} onChange={(e) => setCatchCopy(e.target.value)}
            placeholder="空欄なら汎用の一文が入ります" className={`${inputCls} resize-y`} />
          {aiError && <p className="text-[11px] text-red-600 mt-1">{aiError}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">発行者（拠点社名）</label>
            <input type="text" name="issuerName" defaultValue={values.issuerName ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">お問い合わせ（担当・電話・メール）</label>
            <input type="text" name="issuerContact" defaultValue={values.issuerContact ?? ""} placeholder="例: 白川 090-xxxx-xxxx" className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">代表への申し送り</label>
          <textarea name="replyNote" rows={2} defaultValue={values.replyNote ?? ""} placeholder="例: 隣の◯◯市も合算したほうが安く見えます" className={`${inputCls} resize-y`} />
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-zinc-100">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-zinc-700">ステータス</label>
            <select name="status" defaultValue={status} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white">
              {TVER_FLYER_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/api/tver-flyer/${requestId}/pdf?preview=1`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
              <Eye className="w-4 h-4" />保存済みの内容でPDFを確認
            </a>
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              保存する
            </button>
          </div>
        </div>
        <p className="text-[11px] text-zinc-400">
          ステータスを「納品済み」で保存すると、依頼者にアプリ内通知＋メールが届き、PDFをダウンロードできるようになります。
        </p>
      </form>
    </div>
  );
}
