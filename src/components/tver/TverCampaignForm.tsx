"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Search, X, ExternalLink } from "lucide-react";
import { getApprovedAdvertiserById } from "@/lib/actions/advertiser-review";
import {
  BUDGET_TYPE_OPTIONS,
  FREQ_CAP_UNIT_OPTIONS,
  COMPANION_MOBILE_OPTIONS,
  COMPANION_PC_OPTIONS,
} from "@/lib/constants/tver-campaign";

type Advertiser = { id: string; name: string; productUrl: string };

type AdvertiserDetail = {
  id: string;
  name: string;
  websiteUrl: string;
  productUrl: string;
  corporateNumber: string | null;
  hasNoCorporateNumber: boolean;
};

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  advertisers: Advertiser[];
}

export function TverCampaignForm({ action, advertisers }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [selectedId, setSelectedId]   = useState("");
  const [detail, setDetail]           = useState<AdvertiserDetail | null>(null);
  const [isFetching, startFetch]      = useTransition();
  const [hasFreqCap, setHasFreqCap]   = useState(false);

  const inputCls =
    "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
    "focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 " +
    "bg-white text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400";

  function handleFetch() {
    if (!selectedId) return;
    startFetch(async () => {
      const d = await getApprovedAdvertiserById(selectedId);
      setDetail(d ?? null);
    });
  }

  function handleClear() {
    setSelectedId("");
    setDetail(null);
  }

  return (
    <form action={formAction} className="space-y-8 max-w-2xl">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* ════════════════════════════════════
          広告主選択
      ════════════════════════════════════ */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          広告主選択
        </h3>
        <div className="space-y-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200">

          {/* 広告主ドロップダウン */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              広告主名（承認済みのみ）<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="flex gap-2">
              <select
                name="advertiserId"
                value={selectedId}
                onChange={(e) => { setSelectedId(e.target.value); setDetail(null); }}
                required
                className={`${inputCls} flex-1`}
              >
                <option value="">— 選択してください —</option>
                {advertisers.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              {/* 取得ボタン */}
              <button
                type="button"
                onClick={handleFetch}
                disabled={!selectedId || isFetching}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-700 text-white
                           text-xs font-semibold rounded-lg hover:bg-zinc-900
                           disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {isFetching
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Search className="w-3.5 h-3.5" />}
                取得
              </button>

              {/* クリアボタン */}
              <button
                type="button"
                onClick={handleClear}
                disabled={!selectedId}
                className="flex items-center gap-1 px-3 py-2 border border-zinc-200 text-zinc-500
                           text-xs font-semibold rounded-lg hover:border-zinc-400 hover:text-zinc-800
                           disabled:opacity-40 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                クリア
              </button>
            </div>

            {advertisers.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                承認済みの広告主がいません。先に業態考査申請を行い、承認を受けてください。
              </p>
            )}
          </div>

          {/* 広告主詳細パネル */}
          {detail && (
            <div className="p-3 bg-white border border-blue-200 rounded-lg space-y-1.5">
              <p className="text-xs font-semibold text-blue-700 mb-2">広告主情報</p>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <span className="text-zinc-500 font-medium">広告主名</span>
                <span className="text-zinc-800 font-semibold">{detail.name}</span>

                <span className="text-zinc-500 font-medium">法人番号</span>
                <span className="text-zinc-800 font-mono">
                  {detail.hasNoCorporateNumber ? "なし" : (detail.corporateNumber ?? "—")}
                </span>

                <span className="text-zinc-500 font-medium">企業ページ</span>
                <a
                  href={detail.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1 truncate"
                >
                  {detail.websiteUrl}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>

                <span className="text-zinc-500 font-medium">商材サイト</span>
                <a
                  href={detail.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1 truncate"
                >
                  {detail.productUrl}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════
          案件基本情報
      ════════════════════════════════════ */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          案件基本情報
        </h3>
        <div className="space-y-4">

          {/* キャンペーン名 */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              キャンペーン名<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              name="campaignName"
              placeholder="例: ○○サービス 2026春キャンペーン"
              required
              maxLength={200}
              className={inputCls}
            />
          </div>

          {/* 広告予算 */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              広告予算<span className="text-red-500 ml-0.5">*</span>
              <span className="ml-1 text-zinc-400 font-normal text-[11px]">円・税抜</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">¥</span>
              <input
                type="number"
                name="budget"
                placeholder="1000000"
                required
                min={1}
                className={`${inputCls} pl-7`}
              />
            </div>
          </div>

          {/* 配信期間 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                配信開始日<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input type="date" name="startDate" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                配信終了日<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input type="date" name="endDate" required className={inputCls} />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          予算・配信設定
      ════════════════════════════════════ */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          予算・配信設定
        </h3>
        <div className="space-y-5">

          {/* 予算タイプ */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-2">
              予算タイプ<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="space-y-2">
              {BUDGET_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-start gap-3 p-3 border border-zinc-200 rounded-lg
                             cursor-pointer hover:border-blue-300 hover:bg-blue-50/50
                             has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50
                             transition-colors"
                >
                  <input
                    type="radio"
                    name="budgetType"
                    value={opt.value}
                    required
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{opt.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* フリークエンシーキャップ */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasFreqCap}
                onChange={(e) => setHasFreqCap(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              フリークエンシーキャップを設定する
            </label>

            {hasFreqCap && (
              <div className="flex items-center gap-3 mt-2 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                <div className="flex-1">
                  <label className="block text-[11px] text-zinc-500 mb-1">カウント単位</label>
                  <select name="freqCapUnit" className={inputCls}>
                    {FREQ_CAP_UNIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] text-zinc-500 mb-1">回数</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="freqCapCount"
                      min={1}
                      placeholder="3"
                      className={`${inputCls} pr-8`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                      回
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          コンパニオン AD 設定
      ════════════════════════════════════ */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          コンパニオン AD 設定
        </h3>
        <div className="grid grid-cols-2 gap-6">

          {/* モバイル */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-2">
              モバイル<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="space-y-1.5">
              {COMPANION_MOBILE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-3 py-2 border border-zinc-200
                             rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50/50
                             has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50
                             transition-colors"
                >
                  <input
                    type="radio"
                    name="companionMobile"
                    value={opt.value}
                    defaultChecked={opt.value === "NONE"}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-zinc-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* PC */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-2">
              PC<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="space-y-1.5">
              {COMPANION_PC_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-3 py-2 border border-zinc-200
                             rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50/50
                             has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50
                             transition-colors"
                >
                  <input
                    type="radio"
                    name="companionPc"
                    value={opt.value}
                    defaultChecked={opt.value === "NONE"}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-zinc-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          URL 設定
      ════════════════════════════════════ */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          URL 設定
        </h3>
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            リンク先 LP URL
            <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
          </label>
          <input
            type="url"
            name="landingPageUrl"
            placeholder="https://www.example.co.jp/lp"
            maxLength={500}
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-zinc-400">
            広告クリック時のリンク先URLを入力してください
          </p>
        </div>
      </section>

      {/* ── 送信ボタン ── */}
      <div className="flex items-center gap-3 pt-2 border-t border-zinc-100">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-blue-700 text-white
                     text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60
                     transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          申請を送信する
        </button>
        <a
          href="/dashboard/tver-campaign"
          className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          キャンセル
        </a>
      </div>
    </form>
  );
}
