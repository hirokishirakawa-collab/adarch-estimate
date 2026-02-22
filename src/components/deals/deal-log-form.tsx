"use client";

import { useActionState, useEffect, useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/constants/crm";
import { createDealLog } from "@/lib/actions/deal";

interface Props {
  dealId: string;
  staffName: string;
}

function getInitials(name: string): string {
  return name.slice(0, 2);
}

const DEAL_LOG_TYPES = ACTIVITY_TYPE_OPTIONS.filter((o) => o.value !== "SYSTEM");

export function DealLogForm({ dealId, staffName }: Props) {
  const [state, formAction, isPending] = useActionState(createDealLog, null);
  const [type, setType] = useState<string>("CALL");
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => setFormKey((k) => k + 1), 800);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form key={formKey} action={formAction} className="space-y-3">
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="type" value={type} />

      {/* 活動種別 */}
      <div className="flex flex-wrap gap-1.5">
        {DEAL_LOG_TYPES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setType(opt.value)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              type === opt.value
                ? cn(
                    opt.color,
                    "shadow-sm ring-1 ring-offset-1",
                    opt.color.includes("blue")
                      ? "ring-blue-300"
                      : opt.color.includes("violet")
                        ? "ring-violet-300"
                        : opt.color.includes("emerald")
                          ? "ring-emerald-300"
                          : opt.color.includes("orange")
                            ? "ring-orange-300"
                            : "ring-zinc-300"
                  )
                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
            )}
          >
            <span>{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* 活動内容 */}
      <textarea
        name="content"
        rows={3}
        placeholder="活動内容を入力（例：〇〇様と電話。先方の予算感を確認。次回は提案書を送付予定）"
        required
        className="w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   placeholder:text-zinc-400 resize-none leading-relaxed"
      />

      {/* フッター */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 flex-shrink-0">
            {getInitials(staffName)}
          </div>
          <span className="text-[11px] text-zinc-500">
            <span className="font-medium text-zinc-600">{staffName}</span> として記録
          </span>
        </div>

        {state?.success ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
            記録しました
          </span>
        ) : (
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white
                       rounded-lg hover:bg-blue-700 active:bg-blue-800
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                記録する
              </>
            )}
          </button>
        )}
      </div>

      {state?.error && (
        <p className="text-xs text-red-600 font-medium">{state.error}</p>
      )}
    </form>
  );
}
