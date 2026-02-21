"use client";

import { useActionState, useEffect, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/constants/crm";
import { createActivityLog } from "@/lib/actions/customer";

interface Props {
  customerId: string;
}

export function ActivityForm({ customerId }: Props) {
  const [state, formAction, isPending] = useActionState(
    createActivityLog,
    null
  );
  const [type, setType] = useState<string>("CALL");
  const [formKey, setFormKey] = useState(0);

  // 送信成功時にフォームをリセット
  useEffect(() => {
    if (state?.success) {
      setFormKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form key={formKey} action={formAction} className="space-y-3">
      {/* hidden fields */}
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="type" value={type} />

      {/* 活動種別セレクター */}
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITY_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setType(opt.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              type === opt.value
                ? cn(opt.color, "shadow-sm")
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
        placeholder="活動内容を入力してください（例：〇〇様と電話。来週の提案日程を調整中）"
        required
        className="w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-zinc-400 resize-none leading-relaxed"
      />

      {/* エラー */}
      {state?.error && (
        <p className="text-xs text-red-600 font-medium">{state.error}</p>
      )}

      {/* 送信ボタン */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-400">
          記録者名はログインアカウントから自動取得されます
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      </div>
    </form>
  );
}
