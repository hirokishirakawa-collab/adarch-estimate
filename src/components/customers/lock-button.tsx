"use client";

import { useState, useTransition } from "react";
import { Lock, LockOpen, Loader2 } from "lucide-react";
import { lockCustomer, unlockCustomer } from "@/lib/actions/customer";

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

  const handleLock = () => {
    setError(null);
    startTransition(async () => {
      const result = await lockCustomer(customerId);
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
    <div className="flex flex-col items-end gap-1">
      {!isLocked && (
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
          営業担当に設定
        </button>
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
