"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAllLeads } from "@/lib/actions/lead";
import { useRouter } from "next/navigation";

export function LeadDeleteAllButton({ totalCount }: { totalCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  if (totalCount === 0) return null;

  const handleClick = () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteAllLeads();
      if (result.error) {
        alert(result.error);
      }
      setConfirmed(false);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      {confirmed && (
        <span className="text-xs text-red-600">
          {totalCount}件すべて削除されます。本当に実行しますか？
        </span>
      )}
      <Button
        size="sm"
        variant={confirmed ? "destructive" : "outline"}
        onClick={handleClick}
        disabled={isPending}
        className="gap-1.5"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
        {confirmed ? "削除を実行" : "一括削除"}
      </Button>
      {confirmed && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmed(false)}
          disabled={isPending}
        >
          キャンセル
        </Button>
      )}
    </div>
  );
}
