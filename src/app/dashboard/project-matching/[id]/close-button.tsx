"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closeProjectRequest } from "@/lib/actions/project-matching";
import { XCircle } from "lucide-react";

export function CloseButton({
  projectRequestId,
  title,
}: {
  projectRequestId: string;
  title: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleClose = async () => {
    if (
      !confirm(
        `「${title}」をクローズしますか？\n募集が終了し、新規応募を受け付けなくなります。`
      )
    )
      return;

    setIsPending(true);
    setError(null);
    const result = await closeProjectRequest(projectRequestId);
    if (result.error) {
      setError(result.error);
      setIsPending(false);
    } else {
      router.refresh();
    }
  };

  return (
    <div>
      <button
        onClick={handleClose}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-50 border border-zinc-300 rounded-md hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <XCircle className="w-3.5 h-3.5" />
        {isPending ? "処理中..." : "この案件をクローズ"}
      </button>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
