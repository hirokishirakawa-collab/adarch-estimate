"use client";

import { useState } from "react";
import { matchProject } from "@/lib/actions/project-matching";
import { Mail } from "lucide-react";

const CEO_EMAIL = "hiroki.shirakawa@adarch.co.jp";

function buildMailtoUrl(projectTitle: string, applicantName: string) {
  const subject = `【案件マッチング】${projectTitle} - ${applicantName}`;
  const body = `白川さん\n\n案件「${projectTitle}」について、${applicantName} とマッチングしました。\n詳細についてご相談させてください。`;
  return `mailto:${CEO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function MatchButton({
  projectRequestId,
  applicantCompanyId,
  applicantName,
  projectTitle,
}: {
  projectRequestId: string;
  applicantCompanyId: string;
  applicantName: string;
  projectTitle: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [matched, setMatched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mailtoUrl = buildMailtoUrl(projectTitle, applicantName);

  const handleMatch = async () => {
    if (!confirm(`${applicantName} にマッチングしますか？\n白川へのメールが開きます。`)) return;
    setIsPending(true);
    setError(null);
    const result = await matchProject(projectRequestId, applicantCompanyId);
    if (result.error) {
      setError(result.error);
      setIsPending(false);
    } else {
      setMatched(true);
      setIsPending(false);
      window.location.href = mailtoUrl;
    }
  };

  if (matched) {
    return (
      <div className="flex-shrink-0">
        <a
          href={mailtoUrl}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          <Mail className="w-3 h-3" />
          白川にメール
        </a>
      </div>
    );
  }

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
