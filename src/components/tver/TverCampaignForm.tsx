"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Search, X, ExternalLink } from "lucide-react";
import { getApprovedAdvertiserById } from "@/lib/actions/advertiser-review";
import {
  BUDGET_TYPE_OPTIONS,
  FREQ_CAP_UNIT_OPTIONS,
  COMPANION_MOBILE_OPTIONS,
  COMPANION_PC_OPTIONS,
  GENDER_TARGET_OPTIONS,
  TVER_AREA_GROUPS,
  AD_DURATION_OPTIONS,
  DEVICE_OPTIONS,
  AGE_GROUP_OPTIONS,
  GENRE_OPTIONS,
  GENRE_EXCLUDE_OPTIONS,
  SUB_GENRE_EXCLUDE_OPTIONS,
  INTEREST_OPTIONS,
  INCOME_OPTIONS,
  TV_VIEWING_OPTIONS,
  DEMOGRAPHIC_OPTIONS,
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
  const [hasFreqCap, setHasFreqCap]   = useState(true);
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());

  // 拡張設定
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set(["PC", "SP_IOS", "SP_ANDROID", "CTV"]));
  const [useAge, setUseAge] = useState(false);
  const [selectedAges, setSelectedAges] = useState<Set<string>>(new Set());
  const [useGenre, setUseGenre] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [useGenreExclude, setUseGenreExclude] = useState(false);
  const [selectedGenreExcludes, setSelectedGenreExcludes] = useState<Set<string>>(new Set());
  const [useSubGenreExclude, setUseSubGenreExclude] = useState(false);
  const [selectedSubGenreExcludes, setSelectedSubGenreExcludes] = useState<Set<string>>(new Set());
  const [selectedAdDurations, setSelectedAdDurations] = useState<Set<string>>(new Set(["15"]));
  // オーディエンス詳細
  const [useInterest, setUseInterest] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
  const [useIncome, setUseIncome] = useState(false);
  const [selectedIncomes, setSelectedIncomes] = useState<Set<string>>(new Set());
  const [useTvViewing, setUseTvViewing] = useState(false);
  const [selectedTvViewings, setSelectedTvViewings] = useState<Set<string>>(new Set());
  const [useDemographic, setUseDemographic] = useState(false);
  const [selectedDemographics, setSelectedDemographics] = useState<Set<string>>(new Set());
  const [useHourlyBudget, setUseHourlyBudget] = useState(false);
  const [hourlyRatios, setHourlyRatios] = useState<Record<number, number>>(
    Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i, i >= 0 && i <= 1 ? 6 : i >= 2 && i <= 4 ? 5 : i >= 22 ? 5 : i >= 12 && i <= 13 ? 6 : 4]))
  );
  // フリークエンシー詳細（4段階）
  const [freqPeriod, setFreqPeriod] = useState({ enabled: false, value: "" });
  const [freqWeekly, setFreqWeekly] = useState({ enabled: false, value: "" });
  const [freqDaily, setFreqDaily]   = useState({ enabled: false, value: "" });
  const [freqHourly, setFreqHourly] = useState({ enabled: false, value: "" });
  const [useDailyBudget, setUseDailyBudget] = useState(false);
  const [useLastDayBudget, setUseLastDayBudget] = useState(false);

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, code: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleArea(code: string) {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleRegion(areas: readonly { code: string }[]) {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      const allSelected = areas.every((a) => next.has(a.code));
      for (const a of areas) {
        if (allSelected) next.delete(a.code);
        else next.add(a.code);
      }
      return next;
    });
  }

  function selectAll() {
    const all = TVER_AREA_GROUPS.flatMap((g) => g.areas.map((a) => a.code));
    setSelectedAreas(new Set(all));
  }

  function clearAll() {
    setSelectedAreas(new Set());
  }

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

          {/* 広告グループ名 */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              広告グループ名
              <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
            </label>
            <input
              type="text"
              name="adGroupName"
              placeholder="例: ○○サービス_関東_15秒"
              maxLength={200}
              className={inputCls}
            />
          </div>

          {/* 広告再生時間（複数選択可） */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-2">
              広告再生時間<span className="text-red-500 ml-0.5">*</span>
              <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">複数選択可</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {AD_DURATION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors
                    ${selectedAdDurations.has(opt.value)
                      ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                >
                  <input
                    type="checkbox"
                    name="adDuration"
                    value={opt.value}
                    checked={selectedAdDurations.has(opt.value)}
                    onChange={() => {
                      setSelectedAdDurations((prev) => {
                        const next = new Set(prev);
                        if (next.has(opt.value)) {
                          if (next.size <= 1) return prev;
                          next.delete(opt.value);
                        } else {
                          next.add(opt.value);
                        }
                        return next;
                      });
                    }}
                    className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
                  />
                  <span className="text-sm">{opt.label}</span>
                  <span className="text-[10px] text-zinc-400">({opt.note})</span>
                </label>
              ))}
            </div>
          </div>

          {/* ステータス */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-2">ステータス</label>
            <div className="flex gap-3">
              {[{ value: "ACTIVE", label: "有効" }, { value: "PAUSED", label: "停止" }].map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg
                             cursor-pointer hover:border-blue-300
                             has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50
                             transition-colors"
                >
                  <input
                    type="radio"
                    name="campaignStatus"
                    value={opt.value}
                    defaultChecked={opt.value === "ACTIVE"}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-zinc-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* オークション入札価格 */}
          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
            <p className="text-xs font-semibold text-zinc-700">オークション入札価格</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              入札価格の設定は本部にて調整いたします。ご希望がある場合は備考欄にご記入ください。
            </p>
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

          {/* 日予算 */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDailyBudget}
                onChange={(e) => setUseDailyBudget(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              日予算を設定する
            </label>
            {useDailyBudget && (
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">¥</span>
                <input type="number" name="dailyBudget" min={0} placeholder="0" className={`${inputCls} pl-7`} />
              </div>
            )}
          </div>

          {/* 配信最終日の日予算 */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useLastDayBudget}
                onChange={(e) => setUseLastDayBudget(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              配信最終日の日予算を設定する
            </label>
            {useLastDayBudget && (
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">¥</span>
                <input type="number" name="lastDayBudget" min={0} placeholder="0" className={`${inputCls} pl-7`} />
              </div>
            )}
          </div>

          {/* 時間毎予算割合 */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useHourlyBudget}
                onChange={(e) => setUseHourlyBudget(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              時間毎予算割合を設定する
            </label>
            {useHourlyBudget && (
              <div className="mt-2 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                <p className="text-[11px] text-zinc-500 mb-2">
                  合計: {Object.values(hourlyRatios).reduce((a, b) => a + b, 0)}% / 100%
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-[11px] text-zinc-500 w-10 text-right">{String(i).padStart(2, "0")}:00</span>
                      <input
                        type="number"
                        value={hourlyRatios[i] ?? 4}
                        min={0}
                        max={100}
                        onChange={(e) => setHourlyRatios((prev) => ({ ...prev, [i]: Number(e.target.value) }))}
                        className="w-14 px-1.5 py-1 text-xs text-center border border-zinc-200 rounded bg-white"
                      />
                      <span className="text-[10px] text-zinc-400">%</span>
                    </div>
                  ))}
                </div>
                <input type="hidden" name="hourlyRatios" value={JSON.stringify(hourlyRatios)} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          フリークエンシー
      ════════════════════════════════════ */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          フリークエンシー
        </h3>
        <div className="space-y-3">
          {([
            { key: "period",  state: freqPeriod,  setter: setFreqPeriod,  label: "期間のフリークエンシーキャップ" },
            { key: "weekly",  state: freqWeekly,  setter: setFreqWeekly,  label: "1週間のフリークエンシーキャップ" },
            { key: "daily",   state: freqDaily,   setter: setFreqDaily,   label: "1日のフリークエンシーキャップ" },
            { key: "hourly",  state: freqHourly,  setter: setFreqHourly,  label: "1時間のフリークエンシーキャップ" },
          ] as const).map(({ key, state, setter, label }) => (
            <div key={key} className="p-3 border border-zinc-200 rounded-lg">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.enabled}
                  onChange={(e) => setter({ ...state, enabled: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
                />
                {label}
              </label>
              {state.enabled && (
                <div className="mt-2 relative">
                  <input
                    type="number"
                    name={`freq_${key}`}
                    value={state.value}
                    min={1}
                    placeholder="回数を入力"
                    onChange={(e) => setter({ ...state, value: e.target.value })}
                    className={`${inputCls} pr-8`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">回</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════
          プレースメント
      ════════════════════════════════════ */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          プレースメント
        </h3>
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-2">
            デバイス<span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {DEVICE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg cursor-pointer transition-colors
                  ${selectedDevices.has(opt.value)
                    ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                  }`}
              >
                <input
                  type="checkbox"
                  name="devices"
                  value={opt.value}
                  checked={selectedDevices.has(opt.value)}
                  onChange={() => toggleSet(setSelectedDevices, opt.value)}
                  className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          オーディエンス
      ════════════════════════════════════ */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          オーディエンス
        </h3>
        <div className="space-y-4">

          {/* 性別ターゲティング */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-2">
              性別ターゲティング<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="flex gap-2">
              {GENDER_TARGET_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5
                             border border-zinc-200 rounded-lg cursor-pointer
                             hover:border-blue-300 hover:bg-blue-50/50
                             has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50
                             transition-colors"
                >
                  <input
                    type="radio"
                    name="genderTarget"
                    value={opt.value}
                    defaultChecked={opt.value === "ALL"}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-zinc-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 年齢 */}
          <div className="p-3 border border-zinc-200 rounded-lg">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useAge}
                onChange={(e) => setUseAge(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              年齢ターゲティングを利用する
            </label>
            {useAge && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {AGE_GROUP_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-colors
                      ${selectedAges.has(opt.value)
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                  >
                    <input
                      type="checkbox"
                      name="ageGroups"
                      value={opt.value}
                      checked={selectedAges.has(opt.value)}
                      onChange={() => toggleSet(setSelectedAges, opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 都道府県/市区町村 → 配信エリアセクションで対応済み */}

          {/* 興味関心 */}
          <div className="p-3 border border-zinc-200 rounded-lg">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useInterest}
                onChange={(e) => setUseInterest(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              興味関心を利用する
            </label>
            {useInterest && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {INTEREST_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-colors
                      ${selectedInterests.has(opt.value)
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                  >
                    <input
                      type="checkbox"
                      name="interests"
                      value={opt.value}
                      checked={selectedInterests.has(opt.value)}
                      onChange={() => toggleSet(setSelectedInterests, opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 世帯年収 */}
          <div className="p-3 border border-zinc-200 rounded-lg">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useIncome}
                onChange={(e) => setUseIncome(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              世帯年収を利用する
            </label>
            {useIncome && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {INCOME_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-colors
                      ${selectedIncomes.has(opt.value)
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                  >
                    <input
                      type="checkbox"
                      name="incomes"
                      value={opt.value}
                      checked={selectedIncomes.has(opt.value)}
                      onChange={() => toggleSet(setSelectedIncomes, opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* テレビ視聴傾向 */}
          <div className="p-3 border border-zinc-200 rounded-lg">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useTvViewing}
                onChange={(e) => setUseTvViewing(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              テレビ視聴傾向を利用する
            </label>
            {useTvViewing && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {TV_VIEWING_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-colors
                      ${selectedTvViewings.has(opt.value)
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                  >
                    <input
                      type="checkbox"
                      name="tvViewings"
                      value={opt.value}
                      checked={selectedTvViewings.has(opt.value)}
                      onChange={() => toggleSet(setSelectedTvViewings, opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* デモグラフィック */}
          <div className="p-3 border border-zinc-200 rounded-lg">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDemographic}
                onChange={(e) => setUseDemographic(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              デモグラフィックを利用する
            </label>
            {useDemographic && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {DEMOGRAPHIC_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-colors
                      ${selectedDemographics.has(opt.value)
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                  >
                    <input
                      type="checkbox"
                      name="demographics"
                      value={opt.value}
                      checked={selectedDemographics.has(opt.value)}
                      onChange={() => toggleSet(setSelectedDemographics, opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          コンテンツ
      ════════════════════════════════════ */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          コンテンツ
        </h3>
        <div className="space-y-4">

          {/* 番組ジャンル */}
          <div className="p-3 border border-zinc-200 rounded-lg">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useGenre}
                onChange={(e) => setUseGenre(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              番組ジャンルを指定する
            </label>
            {useGenre && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {GENRE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-colors
                      ${selectedGenres.has(opt.value)
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                  >
                    <input
                      type="checkbox"
                      name="genres"
                      value={opt.value}
                      checked={selectedGenres.has(opt.value)}
                      onChange={() => toggleSet(setSelectedGenres, opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 番組ジャンル除外 */}
          <div className="p-3 border border-zinc-200 rounded-lg">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useGenreExclude}
                onChange={(e) => setUseGenreExclude(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              番組ジャンルを除外する
            </label>
            {useGenreExclude && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {GENRE_EXCLUDE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-colors
                      ${selectedGenreExcludes.has(opt.value)
                        ? "bg-red-50 border-red-300 text-red-700 font-semibold"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                  >
                    <input
                      type="checkbox"
                      name="genreExcludes"
                      value={opt.value}
                      checked={selectedGenreExcludes.has(opt.value)}
                      onChange={() => toggleSet(setSelectedGenreExcludes, opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 番組サブジャンル除外 */}
          <div className="p-3 border border-zinc-200 rounded-lg">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useSubGenreExclude}
                onChange={(e) => setUseSubGenreExclude(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
              />
              番組サブジャンルを除外する
            </label>
            {useSubGenreExclude && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {SUB_GENRE_EXCLUDE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-colors
                      ${selectedSubGenreExcludes.has(opt.value)
                        ? "bg-red-50 border-red-300 text-red-700 font-semibold"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                  >
                    <input
                      type="checkbox"
                      name="subGenreExcludes"
                      value={opt.value}
                      checked={selectedSubGenreExcludes.has(opt.value)}
                      onChange={() => toggleSet(setSelectedSubGenreExcludes, opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
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
          配信エリア
      ════════════════════════════════════ */}
      <section>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          配信エリア<span className="text-red-500 ml-0.5">*</span>
        </h3>

        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={selectAll}
            className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50
                       border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
          >
            全選択
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-2.5 py-1 text-[11px] font-semibold text-zinc-500 bg-zinc-50
                       border border-zinc-200 rounded-md hover:bg-zinc-100 transition-colors"
          >
            全解除
          </button>
          <span className="text-[11px] text-zinc-400 ml-1">
            {selectedAreas.size > 0 ? `${selectedAreas.size}エリア選択中` : "未選択"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TVER_AREA_GROUPS.map((group) => {
            const allSelected = group.areas.every((a) => selectedAreas.has(a.code));
            const someSelected = group.areas.some((a) => selectedAreas.has(a.code));
            return (
              <div
                key={group.region}
                className="p-3 border border-zinc-200 rounded-lg bg-zinc-50"
              >
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => toggleRegion(group.areas)}
                    className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600"
                  />
                  <span className="text-xs font-bold text-zinc-700">{group.region}</span>
                </label>
                <div className="flex flex-wrap gap-1.5 ml-5">
                  {group.areas.map((area) => (
                    <label
                      key={area.code}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]
                                  cursor-pointer border transition-colors
                                  ${selectedAreas.has(area.code)
                                    ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                                    : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                                  }`}
                    >
                      <input
                        type="checkbox"
                        name="areas"
                        value={area.code}
                        checked={selectedAreas.has(area.code)}
                        onChange={() => toggleArea(area.code)}
                        className="sr-only"
                      />
                      {area.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
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

      {/* 拡張設定（JSON hidden） */}
      <input
        type="hidden"
        name="settings"
        value={JSON.stringify({
          adDurations: [...selectedAdDurations],
          devices: [...selectedDevices],
          ageGroups: useAge ? [...selectedAges] : [],
          interests: useInterest ? [...selectedInterests] : [],
          incomes: useIncome ? [...selectedIncomes] : [],
          tvViewings: useTvViewing ? [...selectedTvViewings] : [],
          demographics: useDemographic ? [...selectedDemographics] : [],
          genres: useGenre ? [...selectedGenres] : [],
          genreExcludes: useGenreExclude ? [...selectedGenreExcludes] : [],
          subGenreExcludes: useSubGenreExclude ? [...selectedSubGenreExcludes] : [],
          hourlyRatios: useHourlyBudget ? hourlyRatios : null,
          frequency: {
            period: freqPeriod.enabled ? Number(freqPeriod.value) || null : null,
            weekly: freqWeekly.enabled ? Number(freqWeekly.value) || null : null,
            daily: freqDaily.enabled ? Number(freqDaily.value) || null : null,
            hourly: freqHourly.enabled ? Number(freqHourly.value) || null : null,
          },
          dailyBudget: useDailyBudget,
          lastDayBudget: useLastDayBudget,
        })}
      />

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
