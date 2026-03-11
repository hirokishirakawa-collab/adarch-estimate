"use client";

import { Lock, Unlock, TrendingUp } from "lucide-react";

interface UnlockGateProps {
  monthCount: number;
  threshold: number;
}

export function UnlockGate({ monthCount, threshold }: UnlockGateProps) {
  const isUnlocked = monthCount >= threshold;
  const progress = Math.min((monthCount / threshold) * 100, 100);

  if (isUnlocked) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Unlock className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">提案書AIが利用可能です</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            今月 {monthCount}件のアクティビティを記録済み
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <div className="flex items-center gap-4 mb-3">
        <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5 text-zinc-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-800">提案書AI — ロック中</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            今月あと <span className="font-bold text-blue-600">{threshold - monthCount}件</span> のアクティビティで解放
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-medium text-zinc-500 flex-shrink-0">
          {monthCount}/{threshold}
        </span>
      </div>
    </div>
  );
}
