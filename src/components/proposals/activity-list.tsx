"use client";

import { Trash2 } from "lucide-react";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants/proposals";

interface Activity {
  id: string;
  companyName: string;
  type: string;
  note: string | null;
  date: string;
  createdAt: string;
}

interface ActivityListProps {
  activities: Activity[];
  onDelete: (id: string) => void;
}

export function ActivityList({ activities, onDelete }: ActivityListProps) {
  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center">
        <p className="text-sm text-zinc-400">まだアクティビティがありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100">
        <p className="text-sm font-semibold text-zinc-800">最近のアクティビティ</p>
      </div>
      <div className="divide-y divide-zinc-100">
        {activities.map((a) => (
          <div key={a.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 flex-shrink-0">
                {ACTIVITY_TYPE_LABELS[a.type] || a.type}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 truncate">{a.companyName}</p>
                {a.note && <p className="text-xs text-zinc-400 truncate">{a.note}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-zinc-400">
                {new Date(a.date).toLocaleDateString("ja-JP")}
              </span>
              <button
                onClick={() => onDelete(a.id)}
                className="p-1 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
