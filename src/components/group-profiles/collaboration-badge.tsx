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
    <div className="mt-6">
      <div className="relative overflow-hidden rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-blue-50 to-purple-50 p-5 shadow-sm">
        {/* 装飾 */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-violet-200/20 to-transparent rounded-bl-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-200/15 to-transparent rounded-tr-full pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-bold text-violet-900">連携案件</h3>
          </div>

          <div className="space-y-4">
            {highlights.map((h) => (
              <div key={h.id}>
                <div className="flex items-center gap-2 mb-1">
                  {h.emoji && <span className="text-base">{h.emoji}</span>}
                  <span className="text-sm font-bold text-violet-900">{h.title}</span>
                </div>
                <p className="text-xs text-violet-700/80 mb-2 leading-relaxed">
                  {h.description}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {h.members
                    .filter((m) => m.groupCompany.id !== currentCompanyId)
                    .map((m) => (
                      <Link
                        key={m.groupCompany.id}
                        href={`/dashboard/group-profiles/${m.groupCompany.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-white/80 text-violet-700 rounded-full border border-violet-200/60 hover:bg-white hover:border-violet-300 transition-colors shadow-sm"
                      >
                        {m.groupCompany.emoji && (
                          <span className="text-xs">{m.groupCompany.emoji}</span>
                        )}
                        {m.groupCompany.ownerName}
                        <span className="text-violet-400">と連携中</span>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
