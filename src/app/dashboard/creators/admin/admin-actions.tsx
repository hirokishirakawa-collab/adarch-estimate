"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCreatorStatus, upsertCreatorRating, deleteCreator } from "./actions";

interface Props {
  creatorId: string;
  currentStatus: string;
  userId: string;
  latestRating: {
    personality: number;
    actualSkill: number;
    responseSpeed: number;
    deadlineCompliance: number;
    repeatIntention: string;
    videoInterviewed: boolean;
    notes: string;
  } | null;
}

export function CreatorAdminActions({
  creatorId,
  currentStatus,
  userId,
  latestRating,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  // 評価フォーム
  const [personality, setPersonality] = useState(
    latestRating?.personality || 5
  );
  const [actualSkill, setActualSkill] = useState(
    latestRating?.actualSkill || 5
  );
  const [responseSpeed, setResponseSpeed] = useState(
    latestRating?.responseSpeed || 5
  );
  const [deadlineCompliance, setDeadlineCompliance] = useState(
    latestRating?.deadlineCompliance || 5
  );
  const [repeatIntention, setRepeatIntention] = useState(
    latestRating?.repeatIntention || "GOOD"
  );
  const [videoInterviewed, setVideoInterviewed] = useState(
    latestRating?.videoInterviewed || false
  );
  const [notes, setNotes] = useState(latestRating?.notes || "");

  const handleStatusChange = (newStatus: string) => {
    const labels: Record<string, string> = {
      ACTIVE: "アクティブに戻す",
      BANNED: "BANする（本人に通知されます）",
      SHADOW_BANNED: "シャドウBANする（本人には通知されません）",
      INACTIVE: "非アクティブにする",
    };
    if (!confirm(`${labels[newStatus]}。よろしいですか？`)) return;

    startTransition(async () => {
      const result = await updateCreatorStatus(creatorId, newStatus);
      if (result.success) {
        setMessage("ステータスを更��しました");
        router.refresh();
      } else {
        setMessage(result.error || "エラーが発生しました");
      }
    });
  };

  const handleRatingSubmit = () => {
    startTransition(async () => {
      const result = await upsertCreatorRating({
        creatorId,
        ratedById: userId,
        personality,
        actualSkill,
        responseSpeed,
        deadlineCompliance,
        repeatIntention,
        videoInterviewed,
        notes,
      });
      if (result.success) {
        setMessage("評価を保存��ました");
        router.refresh();
      } else {
        setMessage(result.error || "エラーが発生しました");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("このクリエイターの登録を完全に削除しますか？この操作は取り消せません。")) return;
    if (!confirm("本当に削除してよろしいですか？関連する評価・NDA・ポートフォリオも全て削除されます。")) return;

    startTransition(async () => {
      const result = await deleteCreator(creatorId);
      if (result.success) {
        router.push("/dashboard/creators/admin");
        router.refresh();
      } else {
        setMessage(result.error || "削除に失敗しました");
      }
    });
  };

  const STATUS_OPTIONS = [
    { value: "ACTIVE", label: "アクティブ", cls: "bg-emerald-500" },
    { value: "SHADOW_BANNED", label: "シャドウBAN", cls: "bg-amber-500" },
    { value: "BANNED", label: "BAN", cls: "bg-red-500" },
    { value: "INACTIVE", label: "非アクティブ", cls: "bg-zinc-400" },
  ];

  return (
    <div className="space-y-4">
      {message && (
        <div className="px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm">
          {message}
        </div>
      )}

      {/* ステータス管理 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <h3 className="font-bold text-sm text-zinc-900 mb-3">ステ���タス管理</h3>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              disabled={isPending || currentStatus === opt.value}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all ${
                currentStatus === opt.value
                  ? `${opt.cls} ring-2 ring-offset-2 ring-zinc-300`
                  : `${opt.cls} opacity-40 hover:opacity-70`
              } disabled:cursor-not-allowed`}
            >
              {opt.label}
              {currentStatus === opt.value && " ✓"}
            </button>
          ))}
        </div>
        {currentStatus === "SHADOW_BANNED" && (
          <p className="mt-2 text-xs text-amber-600">
            このクリエイターはシャドウBAN中です。ログイン・マイページは正常ですが、プロジェクト相談メールは届きません。
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-zinc-200">
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            登録を完全に削除する
          </button>
        </div>
      </div>

      {/* 裏評価フォ���ム */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <h3 className="font-bold text-sm text-zinc-900 mb-4">裏評価</h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <RatingSlider
            label="人柄"
            value={personality}
            onChange={setPersonality}
          />
          <RatingSlider
            label="スキル実力"
            value={actualSkill}
            onChange={setActualSkill}
          />
          <RatingSlider
            label="レスポンス速度"
            value={responseSpeed}
            onChange={setResponseSpeed}
          />
          <RatingSlider
            label="納期遵守"
            value={deadlineCompliance}
            onChange={setDeadlineCompliance}
          />
        </div>

        {/* リピート意向 */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            リピート意向
          </label>
          <div className="flex gap-2">
            {[
              { value: "EXCELLENT", label: "◎ ぜひ" },
              { value: "GOOD", label: "○ OK" },
              { value: "FAIR", label: "△ 微妙" },
              { value: "POOR", label: "× NG" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRepeatIntention(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  repeatIntention === opt.value
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* TV会議面接 */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={videoInterviewed}
              onChange={(e) => setVideoInterviewed(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600"
            />
            <span className="text-sm text-zinc-700">TV会議面接 実施済み</span>
          </label>
        </div>

        {/* メモ */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            メモ（自由記述）
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="案件での印象、注意点など..."
          />
        </div>

        <button
          onClick={handleRatingSubmit}
          disabled={isPending}
          className="w-full py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {isPending ? "保存中..." : "評価を保存"}
        </button>
      </div>
    </div>
  );
}

function RatingSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-zinc-500">{label}</label>
        <span className="text-sm font-bold text-zinc-900">{value}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 h-7 rounded text-xs font-bold transition-all ${
              n <= value
                ? "bg-indigo-500 text-white"
                : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
