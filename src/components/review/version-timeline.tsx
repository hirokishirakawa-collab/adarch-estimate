"use client";

import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Clock } from "lucide-react";

interface VersionInfo {
  id: string;
  version: number;
  status: string;
  totalChanges: number;
  createdAt: string;
  staffName: string;
}

interface Props {
  projectId: string;
  reviews: VersionInfo[];
  selectedVersion: number;
  basePath?: string;
}

const STATUS_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  UPLOADING:  { icon: Loader2,       color: "text-zinc-500" },
  ANALYZING:  { icon: Loader2,       color: "text-amber-400" },
  COMPLETED:  { icon: Clock,         color: "text-blue-400" },
  FAILED:     { icon: AlertTriangle, color: "text-red-400" },
  APPROVED:   { icon: CheckCircle2,  color: "text-emerald-400" },
  REJECTED:   { icon: XCircle,       color: "text-red-400" },
};

export function VersionTimeline({ projectId, reviews, selectedVersion, basePath = "/dashboard/review" }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {reviews.map((r, i) => {
        const isSelected = r.version === selectedVersion;
        const si = STATUS_ICON[r.status] ?? STATUS_ICON.COMPLETED;
        const Icon = si.icon;

        return (
          <div key={r.id} className="flex items-center gap-2 flex-shrink-0">
            {i > 0 && <div className="w-6 h-px bg-zinc-700" />}
            <Link
              href={`${basePath}/${projectId}?v=${r.version}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                isSelected
                  ? "bg-amber-500/10 border-amber-500/30 text-white"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 ${si.color} ${
                  r.status === "ANALYZING" ? "animate-spin" : ""
                }`}
              />
              <span className="text-sm font-medium">v{r.version}</span>
              {r.totalChanges > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 font-medium">
                  {r.totalChanges}件
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
