"use client";

import { useState } from "react";
import { matchProject } from "@/lib/actions/project-matching";

export function MatchButton({
  projectRequestId,
  applicantCompanyId,
  applicantName,
}: {
  projectRequestId: string;
  applicantCompanyId: string;
  applicantName: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMatch = async () => {
    if (!confirm(`${applicantName} にマッチングしますか？`)) return;
    setIsPending(true);
    setError(null);
    const result = await matchProject(projectRequestId, applicantCompanyId);
    if (result.error) {
      setError(result.error);
      setIsPending(false);
    }
  };

  return (
    <div className="flex-shrink-0">
      <button
        onClick={handleMatch}
        disabled={isPending}
        className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "処理中..." : "マッチング"}
      </button>
      {error && (
        <p className="text-[10px] text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
