"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  reviewId: string;
  initialStatus: string;
  onComplete?: () => void;
}

export function AnalysisProgress({ reviewId, initialStatus, onComplete }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  // Start analysis
  useEffect(() => {
    if (initialStatus !== "UPLOADING" || started) return;
    setStarted(true);

    fetch("/api/review/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId }),
    })
      .then((res) => res.json())
      .then(() => setStatus("ANALYZING"))
      .catch((e) => {
        setStatus("FAILED");
        setError(String(e));
      });
  }, [reviewId, initialStatus, started]);

  // Poll status
  useEffect(() => {
    if (status !== "ANALYZING") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/review/status?id=${reviewId}`);
        const data = await res.json();
        if (data.status !== "ANALYZING") {
          setStatus(data.status);
          if (data.analysisError) setError(data.analysisError);
          if (data.status === "COMPLETED") onComplete?.();
          clearInterval(interval);
        }
      } catch {
        // retry
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, reviewId, onComplete]);

  if (status === "ANALYZING" || status === "UPLOADING") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
        <p className="text-white/70 text-lg font-medium">
          {status === "UPLOADING" ? "解析を開始しています..." : "映像を解析中..."}
        </p>
        <p className="text-white/40 text-sm">
          動画の長さに応じて数分かかる場合があります
        </p>
      </div>
    );
  }

  if (status === "FAILED") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <XCircle className="w-12 h-12 text-red-500" />
        <p className="text-red-400 text-lg font-medium">解析に失敗しました</p>
        {error && (
          <p className="text-red-400/60 text-sm max-w-md text-center">{error}</p>
        )}
      </div>
    );
  }

  if (status === "COMPLETED") {
    return (
      <div className="flex items-center gap-2 py-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        <span className="text-emerald-400 text-sm font-medium">解析完了</span>
      </div>
    );
  }

  return null;
}
