"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { getApprovedAdvertiserById } from "@/lib/actions/advertiser-review";

type Advertiser = { id: string; name: string };

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  advertisers: Advertiser[];
}

export function TverCreativeReviewForm({ action, advertisers }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [selectedId, setSelectedId]   = useState("");
  const [fetched, setFetched]         = useState<{ name: string } | null>(null);
  const [isFetching, startFetch]      = useTransition();

  const inputCls =
    "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
    "focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 " +
    "bg-white text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400";

  function handleFetch() {
    if (!selectedId) return;
    startFetch(async () => {
      const d = await getApprovedAdvertiserById(selectedId);
      setFetched(d ? { name: d.name } : null);
    });
  }

  function handleClear() {
    setSelectedId("");
    setFetched(null);
  }

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* 広告主選択 */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          広告主選択
        </h3>
        <div className="space-y-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              広告主様（承認済みのみ）<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="flex gap-2">
              <select
                name="advertiserId"
                value={selectedId}
                onChange={(e) => { setSelectedId(e.target.value); setFetched(null); }}
                className={`${inputCls} flex-1`}
              >
                <option value="">選択してください</option>
                {advertisers.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleFetch}
                disabled={!selectedId || isFetching}
                className="px-3 py-2 text-sm font-semibold text-blue-700 border border-blue-200
                           rounded-lg hover:bg-blue-50 disabled:opacity-40 transition-colors
                           inline-flex items-center gap-1 whitespace-nowrap"
              >
                {isFetching
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Search className="w-3.5 h-3.5" />}
                取得
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 text-sm font-semibold text-zinc-500 border border-zinc-200
                           rounded-lg hover:bg-zinc-100 transition-colors
                           inline-flex items-center gap-1 whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />クリア
              </button>
            </div>
          </div>

          {fetched && (
            <div className="px-4 py-3 bg-white rounded-lg border border-zinc-200 text-sm text-zinc-800">
              <span className="text-xs text-zinc-500 font-semibold mr-2">広告主名</span>
              {fetched.name}
            </div>
          )}
        </div>
      </section>

      {/* 申請内容 */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          申請内容
        </h3>
        <div className="space-y-4">

          {/* プロジェクト名 */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              プロジェクト名<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              name="projectName"
              placeholder="例：○○ブランド 夏季キャンペーン"
              className={inputCls}
            />
          </div>

          {/* 本数 */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              本数<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="number"
              name="numberOfAssets"
              min={1}
              placeholder="例：3"
              className={inputCls}
            />
          </div>

          {/* データ格納リンク */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              データ格納リンク（ドライブ）<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="url"
              name="driveUrl"
              placeholder="https://drive.google.com/..."
              className={inputCls}
            />
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              備考
              <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
            </label>
            <textarea
              name="remarks"
              rows={4}
              placeholder="補足事項があれば記入してください"
              className={`${inputCls} resize-y`}
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-700 text-white
                   text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60
                   transition-colors"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        申請する
      </button>
    </form>
  );
}
