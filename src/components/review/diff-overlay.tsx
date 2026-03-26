"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";

interface Props {
  changeId: string;
  beforeFramePath: string | null;
  afterFramePath: string | null;
  diffFramePath: string | null;
  description: string;
  onClose: () => void;
}

export function DiffOverlay({
  beforeFramePath,
  afterFramePath,
  diffFramePath,
  description,
  onClose,
}: Props) {
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [diffUrl, setDiffUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"diff" | "before" | "after">("diff");

  useEffect(() => {
    async function loadUrls() {
      setLoading(true);
      const fetchUrl = async (path: string | null) => {
        if (!path) return null;
        try {
          const res = await fetch(`/api/review/frame?path=${encodeURIComponent(path)}`);
          const data = await res.json();
          return data.url ?? null;
        } catch {
          return null;
        }
      };

      const [b, a, d] = await Promise.all([
        fetchUrl(beforeFramePath),
        fetchUrl(afterFramePath),
        fetchUrl(diffFramePath),
      ]);
      setBeforeUrl(b);
      setAfterUrl(a);
      setDiffUrl(d);
      setLoading(false);
    }
    loadUrls();
  }, [beforeFramePath, afterFramePath, diffFramePath]);

  const currentUrl =
    viewMode === "diff"
      ? diffUrl
      : viewMode === "before"
      ? beforeUrl
      : afterUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="relative max-w-4xl w-full mx-4 bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <p className="text-sm text-white/70 font-medium">{description}</p>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View mode tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-white/5">
          {(
            [
              { key: "diff", label: "差分ハイライト" },
              { key: "before", label: "修正前" },
              { key: "after", label: "修正後" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === tab.key
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Image */}
        <div className="relative min-h-[300px] flex items-center justify-center p-4">
          {loading ? (
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          ) : currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUrl}
              alt={viewMode}
              className="max-w-full max-h-[60vh] rounded-lg"
            />
          ) : (
            <p className="text-white/40 text-sm">画像を読み込めませんでした</p>
          )}
        </div>
      </div>
    </div>
  );
}
