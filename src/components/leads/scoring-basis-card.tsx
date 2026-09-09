"use client";

// ==============================================================
// 「今日の判定基準」カード — リード獲得AIの3画面（BtoC/BtoB/採用）共用
//   受注・送付結果から1日1回組み立てた補正を、更新日と根拠件数つきで見せる。
//   検索後は「この検索に効いた補正」も出す（applied）。
// ==============================================================

import { useEffect, useState } from "react";
import { Scale, ChevronDown, ChevronUp } from "lucide-react";

interface Rule { id: string; family: string; prefecture?: string; delta: number; reason: string; n: number }
interface BasisView {
  day: string;
  windowDays: number;
  wins: { total: number; deals: number; byFamily: Record<string, number>; closingFactors: string[] };
  outreach: { total: number };
  past: { total: number; guessed: number };
  rules: Rule[];
  fixed: string[];
  recent: { day: string; ruleCount: number }[];
}
export interface BasisApplied { day: string; delta: number; reasons: string[]; ruleCount: number }

const fmtDay = (d: string) => {
  const [, m, dd] = d.split("-");
  return `${Number(m)}/${Number(dd)}`;
};

export function ScoringBasisCard({ applied }: { applied?: BasisApplied | null }) {
  const [basis, setBasis] = useState<BasisView | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/leads/scoring-basis", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: BasisView) => setBasis(d))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!basis) {
    return <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-400">今日の判定基準を読み込み中…</div>;
  }

  const yesterday = basis.recent.find((r) => r.day !== basis.day);
  const diff = yesterday ? basis.rules.length - yesterday.ruleCount : null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Scale className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-800">今日の判定基準</span>
        <span className="text-[11px] text-zinc-500">{fmtDay(basis.day)} 更新・直近{basis.windowDays}日の実績から自動生成</span>
        <span className="text-[11px] text-zinc-500">
          受注 {basis.wins.total}社（{basis.wins.deals}件）／過去取引 {basis.past.total}社／送付結果 {basis.outreach.total}件／効いている補正 {basis.rules.length}本
          {diff !== null && diff !== 0 && (
            <span className={diff > 0 ? "text-emerald-600" : "text-amber-600"}>（昨日比 {diff > 0 ? "+" : ""}{diff}）</span>
          )}
        </span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-800 flex items-center gap-0.5">
          {open ? "閉じる" : "根拠を見る"}
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {applied && (
        <p className="mt-2 text-xs text-zinc-700">
          この検索への補正:{" "}
          {applied.delta === 0 ? (
            <span className="text-zinc-500">なし（この業種・エリアは根拠不足のため素点のまま）</span>
          ) : (
            <span className={applied.delta > 0 ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
              {applied.delta > 0 ? "+" : ""}{applied.delta}点（{applied.reasons.join("・")}）
            </span>
          )}
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-2 text-xs">
          <div>
            <p className="text-[11px] text-zinc-500 mb-1">効いている補正（業種・エリアが合う検索にだけ掛かる。合計 -6〜+8点）</p>
            {basis.rules.length === 0 ? (
              <p className="text-zinc-500">なし。根拠が閾値（受注3社・送付結果10件）に届いた項目がまだありません</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {basis.rules.map((r) => (
                  <span key={r.id} className={`px-2 py-0.5 rounded-full border ${r.delta > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                    {r.delta > 0 ? "+" : ""}{r.delta} {r.reason}
                  </span>
                ))}
              </div>
            )}
          </div>
          {basis.wins.closingFactors.length > 0 && (
            <div>
              <p className="text-[11px] text-zinc-500 mb-1">最近の受注の決め手</p>
              <ul className="list-disc pl-4 text-zinc-700 space-y-0.5">
                {basis.wins.closingFactors.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {basis.fixed.length > 0 && (
            <div>
              <p className="text-[11px] text-zinc-500 mb-1">根拠不足で固定（件数が増えれば動く）</p>
              <p className="text-zinc-500">{basis.fixed.slice(0, 8).join("／")}{basis.fixed.length > 8 ? ` ほか${basis.fixed.length - 8}件` : ""}</p>
            </div>
          )}
          <p className="text-[11px] text-zinc-400">材料＝受注した顧客の業種・県（受注日基準・同じ会社は1社。業種が未入力の顧客は社名・案件名から推定し「推定」と明記）／過去取引（180日より前の受注と、OS以前からの取引先。+1の弱い別枠。業種未入力は社名からAIで推定し基準内だけに保持）／広告・メディアは同業のため加点しない／送付後の結果ボタン／アポ・商談化とスキップ。金額は使いません。結果ボタンを押すほど翌日の基準に反映されます</p>
        </div>
      )}
    </div>
  );
}
