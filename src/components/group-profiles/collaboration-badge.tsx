import Link from "next/link";
import { Sparkles } from "lucide-react";

interface HighlightMember {
  groupCompany: {
    id: string;
    name: string;
    ownerName: string;
    emoji: string | null;
  };
}

interface Highlight {
  id: string;
  title: string;
  description: string;
  emoji: string | null;
  members: HighlightMember[];
}

interface CollaborationBadgeProps {
  highlights: Highlight[];
  currentCompanyId: string;
}

export function CollaborationBadge({ highlights, currentCompanyId }: CollaborationBadgeProps) {
  if (highlights.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      {highlights.map((h) => (
        <div
          key={h.id}
          className="rounded-lg border border-violet-200/60 bg-gradient-to-r from-violet-50/80 to-blue-50/60 px-4 py-2.5"
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
            {h.emoji && <span className="text-sm">{h.emoji}</span>}
            <span className="text-xs font-bold text-violet-900">{h.title}</span>
          </div>
          <p className="text-[11px] text-violet-600/70 mb-1.5 leading-relaxed">{h.description}</p>
          <div className="flex items-center gap-1 flex-wrap">
            {h.members
              .filter((m) => m.groupCompany.id !== currentCompanyId)
              .map((m) => (
                <Link
                  key={m.groupCompany.id}
                  href={`/dashboard/group-profiles/${m.groupCompany.id}`}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium bg-white/80 text-violet-700 rounded-full border border-violet-200/50 hover:bg-white hover:border-violet-300 transition-colors"
                >
                  {m.groupCompany.emoji && <span>{m.groupCompany.emoji}</span>}
                  {m.groupCompany.ownerName}
                  <span className="text-violet-400">と連携中</span>
                </Link>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
