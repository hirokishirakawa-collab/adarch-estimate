"use client";

import { useTransition } from "react";
import { FileText, Loader2 } from "lucide-react";
import { generateWeeklyReport } from "@/lib/actions/group-support";

export function GenerateReportButton({ weekId }: { weekId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`${weekId} の週報メールを生成・送信しますか？`)) return;
    startTransition(async () => {
      const result = await generateWeeklyReport(weekId);
      if (result.error) {
        alert(`エラー: ${result.error}`);
      } else {
        alert("週報メールを送信しました");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50
                 disabled:opacity-60 transition-colors"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
      週報を生成
    </button>
  );
}
