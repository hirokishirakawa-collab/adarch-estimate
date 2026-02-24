"use client";

import { useState, useTransition } from "react";
import { Lock, LockOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockCustomer, unlockCustomer } from "@/lib/actions/customer";

const DURATION_OPTIONS = [
  { label: "7日",  days: 7  },
  { label: "14日", days: 14 },
  { label: "30日", days: 30 },
  { label: "60日", days: 60 },
  { label: "90日", days: 90 },
];

interface LockButtonProps {
  customerId: string;
  isLocked: boolean;
  isMyLock: boolean;
  isAdmin: boolean;
}

export function LockButton({
  customerId,
  isLocked,
  isMyLock,
  isAdmin,
}: LockButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(30);

  const handleLock = () => {
    setError(null);
    startTransition(async () => {
      const result = await lockCustomer(customerId, selectedDays);
      if (result?.error) setError(result.error);
    });
  };

  const handleUnlock = () => {
    setError(null);
    startTransition(async () => {
      const result = await unlockCustomer(customerId);
      if (result?.error) setError(result.error);
    });
  };

  const canUnlock = isMyLock || isAdmin;

  return (
    <div className="flex flex-col items-end gap-2">
      {!isLocked && (
        <>
          {/* 期間選択チップ */}
          <div className="flex items-center gap-1">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setSelectedDays(opt.days)}
                className={cn(
                  "px-2 py-0.5 text-[11px] rounded border transition-colors",
                  selectedDays === opt.days
                    ? "bg-amber-100 border-amber-300 text-amber-700 font-semibold"
                    : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* ロックボタン */}
          <button
            onClick={handleLock}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                       border border-amber-200 rounded-lg bg-amber-50 hover:bg-amber-100
                       text-amber-700 transition-colors disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            営業担当に設定（{selectedDays}日間）
          </button>
        </>
      )}

      {isLocked && canUnlock && (
        <button
          onClick={handleUnlock}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                     border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50
                     text-zinc-600 transition-colors disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LockOpen className="w-3.5 h-3.5" />
          )}
          ロック解除
        </button>
      )}

      {error && (
        <p className="text-[11px] text-red-600">{error}</p>
      )}
    </div>
  );
}
