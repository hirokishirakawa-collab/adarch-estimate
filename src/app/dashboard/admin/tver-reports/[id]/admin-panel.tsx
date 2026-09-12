"use client";

// TVer配信実績 — 本部の操作パネル（紐づけ・メモ・確認完了＝公開・公開取消）

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustDeliveryAmount, publishDeliveryReport, unpublishDeliveryReport, updateDeliveryReport } from "@/lib/actions/tver-delivery";
import { AreaPicker } from "@/components/tver/area-picker";

import { SELL_MULTIPLIER } from "@/lib/tver/plan";

export function ReportAdminPanel(p: {
  id: string; status: "IMPORTED" | "PUBLISHED"; groupCompanyId: string; tverOrderId: string; industry: string; adminNote: string; partnerNote: string;
  companies: { id: string; name: string; prefecture: string | null }[];
  orders: { id: string; label: string; hit: boolean }[];
  areaLabel: string; areaPopulation: number | null; sharedNote: string;
  areaOptions: { key: string; label: string; population: number }[];
  areaKeys: string[];
  wholesaleAmount: number; sellAmount: number; sellMultiplier: number; crossCheckAmount: number; crossCheckDiffPct: number;
  sellAmountAdjusted: number | null; adjustNote: string; monthlyBudget: number | null; budgetMode: string; periodDays: number; periodMonths: number;
  hasWarnings: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [company, setCompany] = useState(p.groupCompanyId);
  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? `⚠️ ${r.error}` : r.message ?? "保存しました");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <section className="bg-white border-2 border-zinc-900 rounded-xl p-5 text-sm">
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">公開先の紐づけ</h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => updateDeliveryReport(p.id, fd));
          }}
        >
          <label className="block text-xs text-zinc-600">
            拠点（この拠点の画面に出ます） <span className="text-red-500">*</span>
            <select name="groupCompanyId" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
              <option value="">未選択</option>
              {p.companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.prefecture ? `（${c.prefecture}）` : ""}</option>)}
            </select>
          </label>
          <label className="block text-xs text-zinc-600">
            TVer小口申込（あれば・広告主名が近いものを先頭に）
            <select name="tverOrderId" defaultValue={p.tverOrderId} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
              <option value="">紐づけない</option>
              {p.orders.map((o) => <option key={o.id} value={o.id}>{o.hit ? "★ " : ""}{o.label}</option>)}
            </select>
          </label>
          <label className="block text-xs text-zinc-600">
            広告主の業種（グループ横断のベンチマークの軸。申込に紐づくと自動）
            <input name="industry" defaultValue={p.industry} maxLength={100} list="tver-industry-list" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" placeholder="例: 建設 / 歯科 / 飲食 / 不動産 / 自動車販売 / 興行" />
            <datalist id="tver-industry-list">{["建設・リフォーム", "歯科", "医療・クリニック", "飲食", "不動産", "自動車販売", "美容・サロン", "小売", "学校・塾", "士業", "製造", "観光・宿泊", "介護・福祉", "興行", "冠婚葬祭", "官公庁・公的機関", "採用"].map((x) => <option key={x} value={x} />)}</datalist>
          </label>
          <div className="block text-xs text-zinc-600 border-l-2 border-emerald-500 pl-3">
            商圏（どの規模の市町村で打ったか。ベンチマークの軸）・複数選べます
            <div className="mt-0.5 text-[11px] text-zinc-500">現在: {p.areaLabel || "未設定"}{p.areaPopulation ? `（人口 ${p.areaPopulation.toLocaleString("ja-JP")}人）` : ""}</div>
            <div className="mt-1">
              <AreaPicker name="areaKey" touchedName="areaTouched" options={p.areaOptions} initial={p.areaKeys} />
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">触らなければ変わりません。TVerの「地域」をコピーして貼り付けると一括で選べます。</p>
          </div>
          <label className="block text-xs text-zinc-600 border-l-2 border-emerald-500 pl-3">
            全社に見せる補足（任意・<b>他の拠点の一覧にも出ます</b>）
            <input name="sharedNote" defaultValue={p.sharedNote} maxLength={200} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" placeholder="例: 高松市と坂出市限定で展開。新型車の発売告知" />
            <span className="mt-0.5 block text-[11px] text-zinc-400">どこで・何のために打ったかを一言で。広告主名と金額は書かないでください（他拠点には伏せている情報です）</span>
          </label>
          <label className="block text-xs text-zinc-600 border-l-2 border-emerald-500 pl-3">
            拠点に見せる一言（任意・紐づけた拠点の実績ページにだけ出ます）
            <textarea name="partnerNote" defaultValue={p.partnerNote} rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="例: 7/20〜8/19分。福岡が最も伸びています" />
          </label>
          <label className="block text-xs text-zinc-600">
            本部メモ（内部）
            <textarea name="adminNote" defaultValue={p.adminNote} rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <button disabled={pending} className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm disabled:opacity-50">保存</button>
        </form>
      </section>

      <AmountAdjust
        id={p.id}
        wholesaleAmount={p.wholesaleAmount}
        sellAmount={p.sellAmount}
        sellMultiplier={p.sellMultiplier}
        crossCheckAmount={p.crossCheckAmount}
        crossCheckDiffPct={p.crossCheckDiffPct}
        sellAmountAdjusted={p.sellAmountAdjusted}
        adjustNote={p.adjustNote}
        monthlyBudget={p.monthlyBudget}
        periodDays={p.periodDays}
        periodMonths={p.periodMonths}
        budgetMode={p.budgetMode}
      />

      <section className={`border rounded-xl p-5 text-sm ${p.status === "PUBLISHED" ? "bg-emerald-50 border-emerald-200" : "bg-orange-50 border-orange-200"}`}>
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">{p.status === "PUBLISHED" ? "公開済み" : "確認完了＝拠点に公開"}</h2>
        <p className="text-xs text-zinc-600 mb-3">
          {p.status === "PUBLISHED"
            ? "紐づけた拠点の「TVer配信実績」に売価だけが出ています。取り消すと拠点から見えなくなります。"
            : `左の金額（売価＝卸値×3）と裏計算のずれを見て問題なければ押してください。${p.hasWarnings ? "警告があります。内容を確認してから公開してください。" : ""}${!company ? "拠点が未選択のため公開できません。" : ""}`}
        </p>
        {p.status === "PUBLISHED" ? (
          <button
            disabled={pending}
            className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-800 text-sm disabled:opacity-50"
            onClick={() => {
              if (!confirm("公開を取り消しますか？拠点から見えなくなります。")) return;
              run(() => unpublishDeliveryReport(p.id));
            }}
          >
            公開を取り消す
          </button>
        ) : (
          <button
            disabled={pending || !company}
            className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium disabled:opacity-50"
            onClick={() => {
              if (!confirm("確認完了として拠点に公開します。よろしいですか？（紐づけを変えた場合は先に「保存」してください）")) return;
              run(() => publishDeliveryReport(p.id));
            }}
          >
            確認完了＝公開する
          </button>
        )}
        {msg && <p className="mt-3 text-sm text-zinc-800">{msg}</p>}
      </section>
    </div>
  );
}

// ── 金額の調整（本部だけ）。未消化でも「予算どおり」に見せる／超過ぶんは本部が負担する
function AmountAdjust(p: {
  id: string; wholesaleAmount: number; sellAmount: number; sellMultiplier: number;
  crossCheckAmount: number; crossCheckDiffPct: number; sellAmountAdjusted: number | null; adjustNote: string;
  monthlyBudget: number | null; budgetMode: string; periodDays: number; periodMonths: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [amount, setAmount] = useState(p.sellAmountAdjusted != null ? String(p.sellAmountAdjusted) : "");
  const [budget, setBudget] = useState(p.monthlyBudget != null ? String(p.monthlyBudget) : "");
  const [mode, setMode] = useState<"PERIOD" | "MONTHLY">(p.budgetMode === "MONTHLY" ? "MONTHLY" : "PERIOD");
  const budgetNum = Number(budget.replace(/[,¥￥\s]/g, ""));
  const forPeriod = (amount: number | null) => (amount == null || amount <= 0 ? null : mode === "MONTHLY" ? Math.round(amount * p.periodMonths) : amount);
  const periodBudget = forPeriod(Number.isFinite(budgetNum) && budget.trim() ? budgetNum : null); // 媒体実費ベース
  const periodBudgetSell = periodBudget != null ? periodBudget * SELL_MULTIPLIER : null; // 予算どおりに請求する売価
  const spendDiff = periodBudget != null ? periodBudget - p.wholesaleAmount : null; // ＋=未消化 / −=超過
  // 保存済みの予算から出る売価（＝前に自動で入れた額）。金額欄がこれと同じなら「自動」とみなす
  const savedTarget = (() => {
    const b = forPeriod(p.monthlyBudget);
    return b == null ? null : b * SELL_MULTIPLIER;
  })();
  const plain = (v: string) => v.replace(/[,¥￥\s]/g, "").trim();
  /** 月額予算を変えたら、金額欄が「自動で入れた額のまま」なら新しい予算どおりの額に追随させる */
  const changeBudget = (v: string) => {
    const prevTarget = periodBudgetSell;
    const n = Number(plain(v));
    const b = plain(v) && Number.isFinite(n) ? forPeriod(n) : null;
    const next = b == null ? null : b * SELL_MULTIPLIER;
    setBudget(v);
    setAmount((cur) => {
      const c = plain(cur);
      const isAuto = c === "" || (prevTarget != null && c === String(prevTarget)) || (savedTarget != null && c === String(savedTarget));
      return isAuto && next != null ? String(next) : cur;
    });
  };
  const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
  const v = Number(amount.replace(/[,¥￥\s]/g, ""));
  const valid = amount.trim() !== "" && Number.isFinite(v) && v >= 0;
  const diff = valid ? v - p.sellAmount : 0;

  return (
    <section className="bg-white border-2 border-zinc-900 rounded-xl p-5 text-sm">
      <h2 className="text-sm font-semibold text-zinc-900 mb-1">金額の調整（裏計算のずれ・予算との差）</h2>
      <p className="text-xs text-zinc-500 mb-3">
        予算を使い切れなかった時は予算どおりの額に上げ、出しすぎた時は予算どおりの額に下げます。<b>拠点にはここで入れた金額だけが出ます</b>（卸値・自動計算は本部だけ）。内訳（キャンペーン別・商圏別・日別）は表示回数で比例按分されます。
      </p>
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <div className="rounded-lg border border-zinc-200 px-3 py-2">
          <div className="text-xs text-zinc-500">卸値（CSVのまま）</div>
          <div className="tabular-nums text-base font-medium text-zinc-900">{yen(p.wholesaleAmount)}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 px-3 py-2">
          <div className="text-xs text-zinc-500">自動の売価（卸値×{p.sellMultiplier}）</div>
          <div className="tabular-nums text-base font-medium text-zinc-900">{yen(p.sellAmount)}</div>
        </div>
        <div className={`rounded-lg border px-3 py-2 ${p.crossCheckDiffPct > 3 ? "border-orange-300 bg-orange-50" : "border-zinc-200"}`}>
          <div className="text-xs text-zinc-500">裏計算（表示回数×売単価）</div>
          <div className="tabular-nums text-base font-medium text-zinc-900">{p.crossCheckAmount ? yen(p.crossCheckAmount) : "—"}</div>
          <div className="text-xs text-zinc-400">ずれ {p.crossCheckDiffPct}%</div>
        </div>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await adjustDeliveryAmount(p.id, fd);
            setMsg(r.error ? `⚠️ ${r.error}` : r.message ?? "保存しました");
            router.refresh();
          });
        }}
      >
        <label className="block text-xs text-zinc-600">
          予算＝媒体実費（税抜・TVerに出す媒体費の枠）
          <span className="ml-2 inline-flex items-center gap-3 font-normal">
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="budgetMode" value="PERIOD" checked={mode === "PERIOD"} onChange={() => setMode("PERIOD")} />
              期間予算（この期間で使い切る）
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="budgetMode" value="MONTHLY" checked={mode === "MONTHLY"} onChange={() => setMode("MONTHLY")} />
              月額
            </label>
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              name="monthlyBudget"
              value={budget}
              onChange={(e) => changeBudget(e.target.value)}
              inputMode="numeric"
              placeholder="例: 150000"
              className="w-44 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm tabular-nums"
            />
            {periodBudget != null && periodBudgetSell != null && (
              <>
                <span className="text-[11px] text-zinc-600">
                  {mode === "MONTHLY" ? `${p.periodDays}日＝${p.periodMonths.toFixed(2).replace(/\.?0+$/, "")}ヶ月ぶんの枠 ` : "この期間の枠 "}
                  <b className="tabular-nums">{yen(periodBudget)}</b> → 売価 <b className="tabular-nums">{yen(periodBudgetSell)}</b>
                </span>
                <button type="button" onClick={() => setAmount(String(periodBudgetSell))} className="px-2.5 py-1 rounded-md border border-zinc-300 text-xs text-zinc-700 hover:bg-zinc-50">
                  予算どおりにする
                </button>
              </>
            )}
          </div>
          {spendDiff != null && (
            <span className={`mt-1 block text-[11px] ${spendDiff < 0 ? "text-orange-700" : spendDiff > 0 ? "text-zinc-600" : "text-emerald-700"}`}>
              媒体実費：予算 {yen(periodBudget!)} − 実費 {yen(p.wholesaleAmount)} ＝{" "}
              {spendDiff > 0 ? `未消化 ${yen(spendDiff)}` : spendDiff < 0 ? `超過 ${yen(-spendDiff)}` : "ぴったり"}
            </span>
          )}
          <span className="mt-1 block text-[11px] text-zinc-400">
            {mode === "PERIOD"
              ? `TVerの「期間で予算を消化する」設定はこちら。期間の長さに関わらず、入れた額をそのまま使います（${p.periodDays}日）。`
              : "月数は暦どおりに数えます（8/1〜9/30＝2.00ヶ月）。丸ヶ月から±3日ほどのズレは1ヶ月に丸めます（3/1〜3/29・2/13〜3/15＝どちらも1ヶ月）。"}
            拠点・お客様に出る予算はこれを×{SELL_MULTIPLIER}した額です
          </span>
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-xs text-zinc-600">
            調整後の売価（税抜・空のまま保存すると予算どおりの額が自動で入ります）
            <input
              name="sellAmountAdjusted"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder={String(p.sellAmount)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm tabular-nums"
            />
            {valid && diff !== 0 && (
              <span className={`mt-1 block text-[11px] ${diff < 0 ? "text-orange-700" : "text-emerald-700"}`}>
                自動の売価との差 {diff < 0 ? `−${yen(-diff)}（本部が持つぶん）` : `＋${yen(diff)}（未消化ぶんも予算どおりに請求）`}
              </span>
            )}
          </label>
          <label className="block text-xs text-zinc-600">
            理由（本部内・必須）
            <input name="adjustNote" defaultValue={p.adjustNote} maxLength={200} placeholder="例: 予算未消化のため契約額どおりに調整" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" />
          </label>
        </div>
        <button disabled={pending} className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm disabled:opacity-50">金額を保存</button>
        {msg && <span className="ml-3 text-sm text-zinc-700">{msg}</span>}
      </form>
    </section>
  );
}
