"use client";

import { useActionState, useState } from "react";
import { Loader2, ExternalLink, Info } from "lucide-react";

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
}

export function AdvertiserReviewForm({ action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [hasNoCorp, setHasNoCorp] = useState(false);
  const [corpNumber, setCorpNumber] = useState("");
  const [corpError, setCorpError] = useState<string | null>(null);

  const inputCls =
    "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
    "focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 " +
    "bg-white text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400";

  function handleCorpNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCorpNumber(val);
    if (!hasNoCorp) {
      if (val && !/^\d{0,13}$/.test(val)) {
        setCorpError("数字のみ入力してください");
      } else if (val.length > 0 && val.length !== 13) {
        setCorpError("13桁で入力してください");
      } else {
        setCorpError(null);
      }
    }
  }

  function handleNoCorp(e: React.ChangeEvent<HTMLInputElement>) {
    setHasNoCorp(e.target.checked);
    if (e.target.checked) {
      setCorpError(null);
    }
  }

  return (
    <form action={formAction} className="space-y-6 max-w-xl">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* ── 広告主様名 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          広告主様名<span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          type="text"
          name="name"
          placeholder="例: 株式会社サンプル"
          required
          maxLength={200}
          className={inputCls}
        />
      </div>

      {/* ── 企業ページ URL ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          企業ページURL<span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          type="url"
          name="websiteUrl"
          placeholder="https://www.example.co.jp"
          required
          maxLength={500}
          className={inputCls}
        />
      </div>

      {/* ── 法人番号 ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-zinc-700">
            法人番号
            {!hasNoCorp && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {/* 国税庁 法人番号公表サイトへのリンク */}
          <a
            href="https://www.houjin-bangou.nta.go.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            法人番号を調べる（国税庁）
          </a>
        </div>

        <input
          type="text"
          name="corporateNumber"
          inputMode="numeric"
          placeholder="13桁の数字を入力"
          disabled={hasNoCorp}
          maxLength={13}
          value={corpNumber}
          onChange={handleCorpNumberChange}
          className={inputCls}
        />
        {corpError && !hasNoCorp && (
          <p className="mt-1 text-xs text-red-600">{corpError}</p>
        )}

        {/* なしチェックボックス */}
        <label className="mt-2 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            name="hasNoCorporateNumber"
            checked={hasNoCorp}
            onChange={handleNoCorp}
            className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
          />
          <span className="text-xs text-zinc-600">
            法人番号が存在しない（個人事業主・任意団体など）
          </span>
        </label>

        {hasNoCorp && (
          <div className="mt-2 flex items-start gap-1.5 px-3 py-2 bg-amber-50
                          border border-amber-200 rounded-lg">
            <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              法人番号なしで申請します。審査にお時間をいただく場合があります。
            </p>
          </div>
        )}
      </div>

      {/* ── 商材サイト URL ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          商材サイトURL<span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          type="url"
          name="productUrl"
          placeholder="https://www.example.co.jp/product"
          required
          maxLength={500}
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-zinc-400">
          出稿する商品・サービスが確認できるページを入力してください
        </p>
      </div>

      {/* ── 広告展開希望日 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          広告展開希望日
          <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
        </label>
        <input type="date" name="desiredStartDate" className={inputCls} />
      </div>

      {/* ── 備考 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          備考
          <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
        </label>
        <textarea
          name="remarks"
          rows={5}
          placeholder="業態・商材の詳細、審査にあたって補足すべき事項などを記入してください"
          className={`${inputCls} resize-y`}
        />
      </div>

      {/* ── 送信ボタン ── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || (!hasNoCorp && corpError !== null)}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-700 text-white
                     text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60
                     transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          申請を送信する
        </button>
        <a
          href="/dashboard/tver-review"
          className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          キャンセル
        </a>
      </div>
    </form>
  );
}
