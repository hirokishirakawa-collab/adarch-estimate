"use client";

import { useActionState } from "react";
import { createVideoAchievement } from "@/lib/actions/video-achievement";
import { VIDEO_TYPE_OPTIONS, VIDEO_ACHIEVEMENT_INDUSTRY_OPTIONS } from "@/lib/constants/video-achievements";
import { PREFECTURES } from "@/lib/constants/crm";

export function AchievementForm() {
  const [state, formAction, pending] = useActionState(createVideoAchievement, null);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {state.error}
        </div>
      )}

      {/* 企業名 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          企業名 <span className="text-red-500">*</span>
        </label>
        <input
          name="companyName"
          type="text"
          placeholder="例: 株式会社山田食品"
          required
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 都道府県 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          都道府県 <span className="text-red-500">*</span>
        </label>
        <select
          name="prefecture"
          required
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">選択してください</option>
          {PREFECTURES.map((pref) => (
            <option key={pref} value={pref}>{pref}</option>
          ))}
        </select>
      </div>

      {/* 業種 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">業種</label>
        <select
          name="industry"
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {VIDEO_ACHIEVEMENT_INDUSTRY_OPTIONS.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      </div>

      {/* 制作会社 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          競合制作会社名 <span className="text-red-500">*</span>
        </label>
        <input
          name="productionCompany"
          type="text"
          placeholder="例: 株式会社〇〇映像"
          required
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 動画種別 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">動画種別</label>
        <select
          name="videoType"
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {VIDEO_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 参照URL */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">参照URL</label>
        <input
          name="referenceUrl"
          type="url"
          placeholder="https://..."
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 制作内容 */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">制作内容・メモ</label>
        <textarea
          name="contentSummary"
          rows={4}
          placeholder="制作内容の概要・特徴など"
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {pending ? "登録中..." : "登録する"}
      </button>
    </form>
  );
}
