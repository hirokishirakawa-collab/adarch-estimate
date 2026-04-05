"use client";

import { useState, useTransition } from "react";
import { Sparkles, Save, Check } from "lucide-react";
import { updateDealClosingFactor } from "@/lib/actions/deal";

interface Props {
  dealId: string;
  initialValue: string | null;
}

export function DealClosingFactorCard({ dealId, initialValue }: Props) {
  const [value, setValue] = useState(initialValue || "");
  const [saved, setSaved] = useState(!!initialValue);
  const [isPending, startTransition] = useTransition();

  function onSave() {
    if (!value.trim()) return;
    startTransition(async () => {
      const res = await updateDealClosingFactor(dealId, value);
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const hasContent = !!initialValue;

  return (
    <div
      className={`rounded-xl border p-4 mb-4 ${
        hasContent
          ? "bg-emerald-50/40 border-emerald-200"
          : "bg-amber-50 border-amber-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            hasContent ? "bg-emerald-100" : "bg-amber-100"
          }`}
        >
          <Sparkles
            className={`w-4 h-4 ${hasContent ? "text-emerald-600" : "text-amber-600"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm font-bold ${
              hasContent ? "text-emerald-900" : "text-amber-900"
            }`}
          >
            受注の決め手を記録
          </h3>
          <p
            className={`text-xs mt-0.5 ${
              hasContent ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {hasContent
              ? "アーチくん（AI）の学習データとして活用されています"
              : "AIアシスタントが類似案件を提案する際の根拠になります。ぜひ記録してください。"}
          </p>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="例: 地元×全国をアピールしたところ返信が来た / 予算感を先に確認したのが良かった / 類似業種の事例資料で信頼を得た など"
        rows={3}
        className="w-full mt-3 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
      />
      <div className="flex items-center justify-end gap-2 mt-2">
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
            <Check className="w-3.5 h-3.5" />
            保存しました
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={isPending || !value.trim() || value === initialValue}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            hasContent
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-amber-600 hover:bg-amber-700 text-white"
          } disabled:bg-zinc-300 disabled:cursor-not-allowed`}
        >
          <Save className="w-3.5 h-3.5" />
          {isPending ? "保存中..." : hasContent ? "更新" : "保存"}
        </button>
      </div>
    </div>
  );
}
