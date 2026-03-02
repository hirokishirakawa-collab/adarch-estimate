"use client";

import { useState, useTransition } from "react";
import { Dialog } from "radix-ui";
import { startAttackFromAchievement } from "@/lib/actions/video-achievement";
import { VIDEO_TYPE_OPTIONS } from "@/lib/constants/video-achievements";
import type { UserRole } from "@/types/roles";

interface Achievement {
  id:                string;
  companyName:       string;
  productionCompany: string;
  videoType:         string;
  industry:          string;
  contentSummary:    string | null;
  isProcessed:       boolean;
}

interface AdvisorResult {
  talkPoint:       string;
  keyQuestion:     string;
  adArchStrengths: string[];
  replaceHook:     string;
}

interface Props {
  achievement: Achievement;
  role:        UserRole;
  onAttackDone?: (dealId: string) => void;
}

export function AiTalkModal({ achievement, role, onAttackDone }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [attackResult, setAttackResult] = useState<{ dealId?: string; isNewCustomer?: boolean } | null>(null);

  const videoTypeLabel =
    VIDEO_TYPE_OPTIONS.find((o) => o.value === achievement.videoType)?.label ??
    achievement.videoType;

  const handleOpen = async () => {
    setOpen(true);
    setResult(null);
    setError(null);
    setAttackResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/video-achievement-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName:       achievement.companyName,
          productionCompany: achievement.productionCompany,
          videoType:         videoTypeLabel,
          industry:          achievement.industry,
          contentSummary:    achievement.contentSummary,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setError(err.error ?? "AI処理に失敗しました");
      } else {
        const data = await res.json() as AdvisorResult;
        setResult(data);
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleAttack = () => {
    startTransition(async () => {
      const res = await startAttackFromAchievement(achievement.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setAttackResult({ dealId: res.dealId, isNewCustomer: res.isNewCustomer });
      if (res.dealId && onAttackDone) onAttackDone(res.dealId);
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
      <Dialog.Trigger asChild>
        <button
          onClick={handleOpen}
          className="text-blue-600 hover:underline text-xs font-medium"
        >
          {achievement.companyName}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-xl p-6 focus:outline-none">
          <Dialog.Title className="text-base font-bold text-zinc-900 mb-1">
            AI 差別化トーク — {achievement.companyName}
          </Dialog.Title>
          <Dialog.Description className="text-xs text-zinc-500 mb-4">
            {achievement.productionCompany} の実績を踏まえたリプレイス提案スクリプト
          </Dialog.Description>

          {loading && (
            <div className="space-y-3 animate-pulse">
              {[80, 60, 48, 48].map((w, i) => (
                <div key={i} className={`h-4 bg-zinc-100 rounded w-${w === 80 ? 'full' : `${w}/100`}`} />
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {result && !loading && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">切り出しトーク</p>
                <p className="text-zinc-800 bg-zinc-50 rounded-lg px-3 py-2 text-xs leading-relaxed">{result.talkPoint}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">アポで使える質問</p>
                <p className="text-zinc-800 bg-zinc-50 rounded-lg px-3 py-2 text-xs leading-relaxed">{result.keyQuestion}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">アドアーチの優位性</p>
                <ul className="space-y-1">
                  {result.adArchStrengths.map((s, i) => (
                    <li key={i} className="text-xs text-zinc-700 flex gap-2">
                      <span className="text-blue-500 flex-shrink-0">▸</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">乗り換えフック</p>
                <p className="text-zinc-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs leading-relaxed">{result.replaceHook}</p>
              </div>
            </div>
          )}

          {attackResult && (
            <div className="mt-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              商談を作成しました！
              {attackResult.isNewCustomer && " 新規顧客も登録されました。"}
              <a href="/dashboard/deals" className="ml-2 underline font-medium">商談一覧を確認する →</a>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <Dialog.Close asChild>
              <button className="text-xs text-zinc-500 hover:text-zinc-700 transition-colors">
                閉じる
              </button>
            </Dialog.Close>
            {!achievement.isProcessed && !attackResult && (
              <button
                onClick={handleAttack}
                disabled={isPending}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {isPending ? "処理中..." : "攻略を開始する"}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
