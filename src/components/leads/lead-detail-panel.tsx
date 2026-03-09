"use client";

import { SCORE_ITEMS, getPriorityLabel } from "@/lib/constants/leads";
import type { ScoredLead } from "@/lib/constants/leads";
import {
  MapPin,
  Phone,
  Star,
  ExternalLink,
  Plus,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeadDetailPanelProps {
  lead: ScoredLead;
  isAdded: boolean;
  onToggleAdd: () => void;
}

export function LeadDetailPanel({
  lead,
  isAdded,
  onToggleAdd,
}: LeadDetailPanelProps) {
  const priority = getPriorityLabel(lead.score.total);

  return (
    <div className="bg-zinc-50 border-t border-zinc-200 px-5 py-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 基本情報 */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-zinc-700">
            <MapPin className="w-4 h-4 mt-0.5 text-zinc-400 flex-shrink-0" />
            <span>{lead.address || "住所情報なし"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-700">
            <Phone className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <span>{lead.phone || "電話番号なし"}</span>
          </div>
          {lead.rating > 0 && (
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                {lead.rating.toFixed(1)} ({lead.ratingCount}件のレビュー)
              </span>
            </div>
          )}
          {lead.mapsUrl && (
            <a
              href={lead.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Google Maps で開く
            </a>
          )}
        </div>

        {/* スコア内訳 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            スコア内訳
          </p>
          {SCORE_ITEMS.map((item) => {
            const val = lead.score.breakdown[item.key] ?? 0;
            const pct = (val / item.max) * 100;
            return (
              <div key={item.key} className="flex items-center gap-2">
                <span className="text-xs text-zinc-600 w-24 flex-shrink-0">
                  {item.label}
                </span>
                <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 w-12 text-right">
                  {val}/{item.max}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AIコメント */}
      <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
        <p className="text-xs font-medium text-zinc-500 mb-1">AIコメント</p>
        <p className="text-sm text-zinc-700">{lead.score.comment}</p>
      </div>

      {/* アクション */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${priority.className}`}
        >
          {priority.emoji} {priority.label}（{lead.score.total}点）
        </span>
        <Button
          size="sm"
          variant={isAdded ? "outline" : "default"}
          onClick={onToggleAdd}
        >
          {isAdded ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {isAdded ? "追加済み" : "営業リストへ追加"}
        </Button>
      </div>
    </div>
  );
}
